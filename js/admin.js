// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || !user.username) {
    window.location.href = '/user/login.html';
}

// Check if user is admin
if (user.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    window.location.href = '/dashboard.html';
}

// Display user name
document.getElementById('userName').textContent = user.username;

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});

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

// Load all users
async function loadUsers() {
    try {
        const data = await apiCall('/api/admin/users');
        if (data && data.users) {
            displayUsers(data.users);
            updateStats(data.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="8" class="loading-cell">Failed to load users</td></tr>';
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${escapeHtml(u.username)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge">${u.role}</span></td>
            <td>
                <span class="user-status ${u.is_active ? 'status-active' : 'status-inactive'}">
                    ${u.is_active ? 'Active' : 'Disabled'}
                </span>
            </td>
            <td><strong>${u.item_count}</strong></td>
            <td>${u.has_unlimited ? '♾️ Unlimited' : u.item_limit}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>
                <button class="btn-admin btn-view" onclick="viewUser(${u.id})" title="View Details">👁️</button>
                <button class="btn-admin btn-toggle" onclick="toggleUserStatus(${u.id}, ${u.is_active})" title="Toggle Status">
                    ${u.is_active ? '🔒' : '🔓'}
                </button>
                ${!u.has_unlimited ? `<button class="btn-admin btn-unlock" onclick="unlockUnlimited(${u.id})" title="Unlock Unlimited">♾️</button>` : ''}
                <button class="btn-admin btn-clear" onclick="clearItems(${u.id})" title="Clear Items">🗑️</button>
                <button class="btn-admin btn-delete" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" title="Delete User">❌</button>
            </td>
        </tr>
    `).join('');
}

// Update stats
function updateStats(users) {
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('activeUsers').textContent = users.filter(u => u.is_active).length;
    document.getElementById('totalItems').textContent = users.reduce((sum, u) => sum + u.item_count, 0);
    document.getElementById('unlimitedUsers').textContent = users.filter(u => u.has_unlimited).length;
}

// View user details
async function viewUser(userId) {
    try {
        const data = await apiCall(`/api/admin/user/${userId}`);
        if (data && data.user) {
            displayUserDetails(data.user, data.items);
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        alert('Failed to load user details');
    }
}

// Display user details in modal
function displayUserDetails(user, items) {
    const modal = document.getElementById('userModal');
    const details = document.getElementById('userDetails');
    
    details.innerHTML = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3>${escapeHtml(user.username)}</h3>
            <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
            <p><strong>Role:</strong> ${user.role}</p>
            <p><strong>Status:</strong> <span class="user-status ${user.is_active ? 'status-active' : 'status-inactive'}">${user.is_active ? 'Active' : 'Disabled'}</span></p>
            <p><strong>Item Limit:</strong> ${user.has_unlimited ? '♾️ Unlimited' : user.item_limit}</p>
            <p><strong>Created:</strong> ${formatDate(user.created_at)}</p>
            <p><strong>Last Login:</strong> ${user.last_login ? formatDate(user.last_login) : 'Never'}</p>
        </div>
        
        <h4>Inventory Items (${items.length})</h4>
        ${items.length === 0 ? '<p style="color: #7f8c8d;">No items</p>' : `
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${escapeHtml(item.name)}</td>
                            <td>${escapeHtml(item.category || '-')}</td>
                            <td>${item.quantity} ${item.unit}</td>
                            <td>$${item.price.toFixed(2)}</td>
                            <td>${formatDate(item.updated_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `}
    `;
    
    modal.classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

// Toggle user status
async function toggleUserStatus(userId, isActive) {
    const action = isActive ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${userId}/toggle-status`, {
            method: 'POST'
        });

        if (response && response.success) {
            loadUsers();
        } else {
            alert(response.error || 'Failed to update user status');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert('Failed to update user status');
    }
}

// Unlock unlimited for user
async function unlockUnlimited(userId) {
    if (!confirm('Grant unlimited items to this user?')) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${userId}/unlock-unlimited`, {
            method: 'POST'
        });

        if (response && response.success) {
            alert('Unlimited items unlocked for user');
            loadUsers();
        } else {
            alert(response.error || 'Failed to unlock unlimited');
        }
    } catch (error) {
        console.error('Error unlocking unlimited:', error);
        alert('Failed to unlock unlimited');
    }
}

// Clear user items
async function clearItems(userId) {
    if (!confirm('Are you sure you want to delete all items for this user? This cannot be undone!')) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${userId}/items`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            alert(response.message);
            loadUsers();
        } else {
            alert(response.error || 'Failed to clear items');
        }
    } catch (error) {
        console.error('Error clearing items:', error);
        alert('Failed to clear items');
    }
}

// Delete user
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to permanently delete user "${username}"? This will delete their account and all data!`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${userId}`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            alert('User deleted successfully');
            loadUsers();
        } else {
            alert(response.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
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

// Close modal on outside click
document.getElementById('userModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeUserModal();
    }
});
