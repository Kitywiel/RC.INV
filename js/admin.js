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
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="8" class="loading-cell">Failed to load users. Please refresh the page.</td></tr>';
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr onclick="openUserModal('${u.id}')">
            <td><strong>${escapeHtml(u.username)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge">${u.role === 'owner' ? 'user' : u.role}</span></td>
            <td>
                <span class="user-status ${u.is_active ? 'status-active' : 'status-inactive'}">
                    ${u.is_active ? 'Active' : 'Disabled'}
                </span>
            </td>
            <td><strong>${u.item_count}</strong></td>
            <td>${u.has_unlimited ? '♾️ Unlimited' : u.item_limit}</td>
            <td>${formatDate(u.created_at)}</td>
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

// User Modal Functions
let currentUserData = null;
let currentUserGuests = [];

async function openUserModal(userId) {
    try {
        const data = await apiCall(`/api/admin/user/${userId}`);
        if (data && data.user) {
            currentUserData = data.user;
            currentUserItems = data.items || [];
            
            console.log('User data:', currentUserData);
            
            // Convert string/number to boolean for is_active
            const isActive = currentUserData.is_active === true || currentUserData.is_active === 1 || currentUserData.is_active === '1' || currentUserData.is_active === 'true';
            const hasUnlimited = currentUserData.has_unlimited === true || currentUserData.has_unlimited === 1 || currentUserData.has_unlimited === '1' || currentUserData.has_unlimited === 'true';
            
            // Populate modal
            document.getElementById('modalUsername').textContent = currentUserData.username;
            document.getElementById('modalEmail').textContent = currentUserData.email;
            document.getElementById('modalRole').textContent = currentUserData.role === 'owner' ? 'user' : currentUserData.role;
            document.getElementById('modalStatus').innerHTML = `
                <span class="user-status ${isActive ? 'status-active' : 'status-inactive'}">
                    ${isActive ? 'Active' : 'Disabled'}
                </span>
            `;
            document.getElementById('modalItemCount').textContent = currentUserData.item_count || 0;
            document.getElementById('itemCountBtn').textContent = currentUserData.item_count || 0;
            document.getElementById('modalItemLimit').textContent = hasUnlimited ? '♾️ Unlimited' : currentUserData.item_limit;
            document.getElementById('modalCreated').textContent = formatDate(currentUserData.created_at);
            document.getElementById('modalUserId').textContent = currentUserData.id;

            // Update button states
            document.getElementById('modalToggleText').textContent = isActive ? '🔒 Disable Account' : '🔓 Enable Account';
            document.getElementById('modalUnlockBtn').style.display = hasUnlimited ? 'none' : 'block';

            // Load user's guests
            await loadUserGuests(userId);

            // Show modal
            document.getElementById('userModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        alert('Failed to load user details');
    }
}

async function loadUserGuests(userId) {
    try {
        const response = await apiCall(`/api/admin/user/${userId}/guests`);
        currentUserGuests = response?.guests || [];
        
        console.log('Loaded guests:', currentUserGuests);
        
        const guestCount = document.getElementById('guestCount');
        guestCount.textContent = currentUserGuests.length;
    } catch (error) {
        console.error('Error loading guests:', error);
        currentUserGuests = [];
        const guestCount = document.getElementById('guestCount');
        if (guestCount) {
            guestCount.textContent = '0';
        }
    }
}

function displayUserGuests() {
    const guestsTableBody = document.getElementById('guestsTableBody');
    const guestCountModal = document.getElementById('guestCountModal');
    
    if (!guestsTableBody) {
        console.error('guestsTableBody element not found');
        return;
    }
    
    if (currentUserGuests.length === 0) {
        guestsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7f8c8d; padding: 40px;">No guest accounts</td></tr>';
        guestCountModal.textContent = '0';
        return;
    }

    console.log('Displaying guests:', currentUserGuests);
    guestCountModal.textContent = currentUserGuests.length;
    
    guestsTableBody.innerHTML = currentUserGuests.map(guest => {
        return `
        <tr onclick="openGuestDetailModal('${guest.id}')" style="cursor: pointer;">
            <td><strong>${escapeHtml(guest.username || 'Unknown')}</strong></td>
            <td>${escapeHtml(guest.email || 'No email')}</td>
            <td><span class="badge" style="text-transform: capitalize;">${escapeHtml(guest.permission || 'read-only')}</span></td>
            <td>${formatDate(guest.created_at)}</td>
            <td>${guest.last_login ? formatDate(guest.last_login) : '<span style="color: #95a5a6;">Never</span>'}</td>
        </tr>
        `;
    }).join('');
}

function openGuestsPanel() {
    if (currentUserGuests.length === 0) {
        alert('This user has no guest accounts');
        return;
    }
    displayUserGuests();
    document.getElementById('guestsModal').style.display = 'flex';
}

function closeGuestsModal() {
    document.getElementById('guestsModal').style.display = 'none';
}

// Inventory Panel Functions
let currentUserItems = [];

function openInventoryPanel() {
    if (!currentUserData) return;
    
    // Get items from the current user data fetch
    displayUserInventory();
    document.getElementById('inventoryModal').style.display = 'flex';
}

function displayUserInventory() {
    const itemCountSpan = document.getElementById('inventoryItemCount');
    const tableBody = document.getElementById('inventoryTableBody');
    
    if (!currentUserItems || currentUserItems.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7f8c8d; padding: 40px;">No items found</td></tr>';
        itemCountSpan.textContent = '0';
        return;
    }

    itemCountSpan.textContent = currentUserItems.length;
    
    tableBody.innerHTML = currentUserItems.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category || 'Uncategorized')}</td>
            <td>${escapeHtml(item.quantity?.toString() || '0')}</td>
            <td>$${parseFloat(item.price || 0).toFixed(2)}</td>
            <td>${formatDate(item.updated_at || item.created_at)}</td>
            <td class="actions-cell">
                <button class="btn btn-small btn-delete" onclick="deleteItemFromAdmin('${item.id}')" title="Delete Item">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function closeInventoryModal() {
    document.getElementById('inventoryModal').style.display = 'none';
}

async function deleteItemFromAdmin(itemId) {
    if (!currentUserData) return;
    
    const item = currentUserItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (!confirm(`Delete "${item.name}" from ${currentUserData.username}'s inventory?`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}/item/${itemId}`, {
            method: 'DELETE'
        });
        
        if (response && response.success) {
            // Remove from current list
            currentUserItems = currentUserItems.filter(i => i.id !== itemId);
            displayUserInventory();
            
            // Update counts
            const newCount = currentUserItems.length;
            document.getElementById('modalItemCount').textContent = newCount;
            document.getElementById('itemCountBtn').textContent = newCount;
            
            // Reload users list
            loadUsers();
        } else {
            alert(response.error || 'Failed to delete item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
    }
}

async function clearItemsFromInventoryPanel() {
    if (!currentUserData) return;
    
    const confirmMsg = `Are you sure you want to clear ALL ${currentUserItems.length} items from ${currentUserData.username}'s inventory? This action cannot be undone!`;
    if (!confirm(confirmMsg)) {
        return;
    }

    // Double confirmation for destructive action
    if (!confirm('This will permanently delete all items. Are you absolutely sure?')) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}/items`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            alert('All items cleared successfully');
            currentUserItems = [];
            displayUserInventory();
            
            // Update the item count in user modal
            document.getElementById('modalItemCount').textContent = '0';
            document.getElementById('itemCountBtn').textContent = '0';
            
            // Reload the user list to reflect changes
            loadUsers();
            
            // Close inventory panel
            closeInventoryModal();
        } else {
            alert(response.error || 'Failed to clear items');
        }
    } catch (error) {
        console.error('Error clearing items:', error);
        alert('Failed to clear items. Please try again.');
    }
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
    currentUserData = null;
    currentUserGuests = [];
}

// Modal Action Functions
async function toggleUserStatusFromModal() {
    if (!currentUserData) return;
    
    const action = currentUserData.is_active ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}/toggle-status`, {
            method: 'POST'
        });

        if (response && response.success) {
            alert(`User ${action}d successfully`);
            closeUserModal();
            loadUsers();
        } else {
            alert(response.error || 'Failed to update user status');
        }
    } catch (error) {
        alert('Failed to update user status. Please try again.');
    }
}

async function unlockUnlimitedFromModal() {
    if (!currentUserData) return;
    
    if (!confirm('Grant unlimited items to this user?')) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}/unlock-unlimited`, {
            method: 'POST'
        });

        if (response && response.success) {
            alert('Unlimited items unlocked for user');
            closeUserModal();
            loadUsers();
        } else {
            alert(response.error || 'Failed to unlock unlimited');
        }
    } catch (error) {
        alert('Failed to unlock unlimited. Please try again.');
    }
}

async function warnUserFromModal() {
    if (!currentUserData) return;
    
    const reason = prompt(`Enter warning reason for ${currentUserData.username}:`);
    if (!reason) return;
    
    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}/warn`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });

        if (response && response.success) {
            alert('Warning issued successfully');
        } else {
            alert(response.error || 'Failed to issue warning');
        }
    } catch (error) {
        console.error('Error issuing warning:', error);
        alert('Failed to issue warning. Please try again.');
    }
}

async function resetPasswordFromModal() {
    if (!currentUserData) return;
    
    const newPassword = prompt(`Enter new password for ${currentUserData.username}:\n(minimum 4 characters)`);
    if (!newPassword) return;
    
    if (newPassword.length < 4) {
        alert('Password must be at least 4 characters');
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });

        if (response && response.success) {
            alert('Password reset successfully');
        } else {
            alert(response.error || 'Failed to reset password');
        }
    } catch (error) {
        alert('Failed to reset password. Please try again.');
    }
}

async function deleteUserFromModal() {
    if (!currentUserData) return;
    
    if (!confirm(`⚠️ DELETE user "${currentUserData.username}" permanently?\n\nThis will delete:\n- The user account\n- All their inventory items\n- All their guest accounts\n\nThis CANNOT be undone!`)) {
        return;
    }

    const confirmText = prompt(`Type "${currentUserData.username}" to confirm deletion:`);
    if (confirmText !== currentUserData.username) {
        alert('Deletion cancelled - name did not match');
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentUserData.id}`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            alert('User deleted successfully');
            closeUserModal();
            loadUsers();
        } else {
            alert(response.error || 'Failed to delete user');
        }
    } catch (error) {
        alert('Failed to delete user. Please try again.');
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
document.getElementById('userModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeUserModal();
    }
});

document.getElementById('guestsModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeGuestsModal();
    }
});

document.getElementById('inventoryModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeInventoryModal();
    }
});

document.getElementById('guestDetailModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeGuestDetailModal();
    }
});

// Guest Detail Modal Functions
let currentGuestData = null;

async function openGuestDetailModal(guestId) {
    try {
        // Find guest in current list or fetch fresh data
        let guest = currentUserGuests.find(g => g.id === guestId);
        
        if (!guest) {
            // Fetch guest data if not in current list
            const data = await apiCall(`/api/admin/user/${guestId}`);
            guest = data?.user;
        }
        
        if (!guest) {
            alert('Guest not found');
            return;
        }
        
        currentGuestData = guest;
        
        // Convert status to boolean
        const isActive = guest.is_active === true || guest.is_active === 1 || guest.is_active === '1' || guest.is_active === 'true';
        
        // Fetch warnings count
        let warningCount = 0;
        try {
            const warningData = await apiCall(`/api/admin/user/${guestId}/warnings`);
            warningCount = warningData?.count || 0;
        } catch (error) {
            console.error('Error fetching warnings:', error);
        }
        
        // Populate modal
        document.getElementById('guestUsername').textContent = guest.username;
        document.getElementById('guestEmail').textContent = guest.email;
        document.getElementById('guestRank').innerHTML = `<span class="badge" style="text-transform: capitalize;">${escapeHtml(guest.permission || 'read-only')}</span>`;
        document.getElementById('guestStatus').innerHTML = `
            <span class="user-status ${isActive ? 'status-active' : 'status-inactive'}">
                ${isActive ? 'Active' : 'Disabled'}
            </span>
        `;
        document.getElementById('guestId').textContent = guest.id;
        document.getElementById('guestWarnings').textContent = warningCount;
        
        // Update button
        document.getElementById('guestToggleText').textContent = isActive ? '🔒 Disable Account' : '🔓 Enable Account';
        
        // Close guests list modal and show guest detail modal
        closeGuestsModal();
        document.getElementById('guestDetailModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading guest details:', error);
        alert('Failed to load guest details');
    }
}

function closeGuestDetailModal() {
    document.getElementById('guestDetailModal').style.display = 'none';
    currentGuestData = null;
    // Reopen guests list
    document.getElementById('guestsModal').style.display = 'flex';
}

async function toggleGuestStatus() {
    if (!currentGuestData) return;
    
    const isActive = currentGuestData.is_active === true || currentGuestData.is_active === 1 || currentGuestData.is_active === '1' || currentGuestData.is_active === 'true';
    const action = isActive ? 'disable' : 'enable';
    
    if (!confirm(`Are you sure you want to ${action} this guest account?`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentGuestData.id}/toggle-status`, {
            method: 'POST'
        });

        if (response && response.success) {
            alert(`Guest account ${action}d successfully`);
            closeGuestDetailModal();
            closeGuestsModal();
            loadUsers();
        } else {
            alert(response.error || `Failed to ${action} guest`);
        }
    } catch (error) {
        alert(`Failed to ${action} guest. Please try again.`);
    }
}

async function warnGuest() {
    if (!currentGuestData) return;
    
    const reason = prompt(`Enter warning reason for ${currentGuestData.username}:`);
    if (!reason) return;
    
    try {
        const response = await apiCall(`/api/admin/user/${currentGuestData.id}/warn`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });

        if (response && response.success) {
            alert('Warning issued successfully');
            // Fetch updated warning count
            const warningData = await apiCall(`/api/admin/user/${currentGuestData.id}/warnings`);
            const newCount = warningData?.count || 0;
            document.getElementById('guestWarnings').textContent = newCount;
        } else {
            alert(response.error || 'Failed to issue warning');
        }
    } catch (error) {
        console.error('Error issuing warning:', error);
        alert('Failed to issue warning. Please try again.');
    }
}

async function resetGuestPassword() {
    if (!currentGuestData) return;
    
    const newPassword = prompt(`Enter new password for ${currentGuestData.username}:\n(minimum 4 characters)`);
    if (!newPassword) return;
    
    if (newPassword.length < 4) {
        alert('Password must be at least 4 characters');
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentGuestData.id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });

        if (response && response.success) {
            alert('Guest password reset successfully');
        } else {
            alert(response.error || 'Failed to reset password');
        }
    } catch (error) {
        alert('Failed to reset password. Please try again.');
    }
}

async function deleteGuest() {
    if (!currentGuestData) return;
    
    if (!confirm(`Delete guest account "${currentGuestData.username}"? This cannot be undone!`)) {
        return;
    }

    // Double confirmation
    if (!confirm(`Are you absolutely sure? This will permanently delete the guest account and all their data.`)) {
        return;
    }

    try {
        const response = await apiCall(`/api/admin/user/${currentGuestData.id}`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            alert('Guest deleted successfully');
            closeGuestDetailModal();
            closeGuestsModal();
            loadUsers();
        } else {
            alert(response.error || 'Failed to delete guest');
        }
    } catch (error) {
        alert('Failed to delete guest. Please try again.');
    }
}
