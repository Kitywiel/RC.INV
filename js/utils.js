// Shared utility functions for RC.INV

/**
 * Makes an authenticated API call
 * @param {string} endpoint - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<object|null>} Response data or null on auth failure
 */
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await fetch(endpoint, { ...defaultOptions, ...options });
        
        if (response.status === 401 || response.status === 403) {
            handleAuthFailure();
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

/**
 * Handles authentication failures by redirecting to login
 */
function handleAuthFailure() {
    alert('Session expired. Please login again.');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/user/login.html';
}

/**
 * Checks if user is authenticated and redirects if not
 * @returns {object} User object from localStorage
 */
function requireAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || !user.username) {
        window.location.href = '/user/login.html';
        return null;
    }

    return user;
}

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formats a date string to localized format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date and time
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Logs out the current user
 */
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/start.html';
    }
}

/**
 * Displays user name in the navbar
 * @param {string} username - Username to display
 */
function displayUserName(username) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = username;
    }
}

/**
 * Shows admin navigation link if user is admin
 * @param {string} role - User role
 */
function showAdminLink(role) {
    if (role === 'admin') {
        const adminLink = document.getElementById('adminNavLink');
        if (adminLink) {
            adminLink.style.display = 'inline';
        }
    }
}
