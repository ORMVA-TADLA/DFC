// IndexedDB Configuration
const DB_NAME = 'DataFieldCollectorDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

// Initialize Database
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Save entry to IndexedDB
async function saveToIndexedDB(entry) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get all entries from IndexedDB
async function getAllFromIndexedDB() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const entries = request.result;
            entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            resolve(entries);
        };
        request.onerror = () => reject(request.error);
    });
}

// Delete entry from IndexedDB
async function deleteFromIndexedDB(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get storage estimate
async function getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        return await navigator.storage.estimate();
    }
    return null;
}

// Request persistent storage
async function requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
        return isPersisted;
    }
    return false;
}
