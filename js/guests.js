// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || !user.username) {
    window.location.href = '/user/login.html';
}

// Check if user is guest (guests can't create guests)
if (user.role === 'guest') {
    alert('Guests cannot manage guest accounts');
    window.location.href = '/dashboard.html';
}

// Display user name
document.getElementById('userName').textContent = user.username;

// Load guests on page load
document.addEventListener('DOMContentLoaded', loadGuests);

// API Helper
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    
    if (response.status === 401 || response.status === 403) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/user/login.html';
        return null;
    }

    return response.json();
}

// Load guests
async function loadGuests() {
    try {
        const data = await apiCall('/api/auth/guests');
        if (data && data.guests) {
            displayGuests(data.guests);
        }
    } catch (error) {
        // Guests loading failed silently
    }
}

// Display guests
function displayGuests(guests) {
    const container = document.getElementById('guestList');
    
    if (guests.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 2rem;">No guest accounts yet. Create one above!</p>';
        return;
    }

    container.innerHTML = `
        <table class="inventory-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${guests.map(guest => `
                    <tr>
                        <td><strong>${escapeHtml(guest.username)}</strong></td>
                        <td>${escapeHtml(guest.email)}</td>
                        <td>${formatDate(guest.created_at)}</td>
                        <td>${guest.last_login ? formatDate(guest.last_login) : 'Never'}</td>
                        <td>
                            <button class="btn btn-small btn-delete" onclick="deleteGuest('${guest.id}', '${escapeHtml(guest.username)}')" title="Delete Guest">🗑️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Create guest
async function createGuest(event) {
    event.preventDefault();

    const guestData = {
        username: document.getElementById('guestUsername').value.trim(),
        email: document.getElementById('guestEmail').value.trim(),
        password: document.getElementById('guestPassword').value
    };

    try {
        const response = await apiCall('/api/auth/create-guest', {
            method: 'POST',
            body: JSON.stringify(guestData)
        });

        if (response && response.success) {
            alert('Guest account created successfully!');
            document.getElementById('createGuestForm').reset();
            loadGuests();
        } else {
            alert(response.error || 'Failed to create guest account');
        }
    } catch (error) {
        alert('Failed to create guest account. Please try again.');
    }
}

// Delete guest
async function deleteGuest(id, username) {
    if (!confirm(`Are you sure you want to delete guest account "${username}"?`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/auth/guest/${id}`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            loadGuests();
        } else {
            alert(response.error || 'Failed to delete guest');
        }
    } catch (error) {
        alert('Failed to delete guest. Please try again.');
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/start.html';
    }
}
