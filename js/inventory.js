// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || !user.username) {
    window.location.href = '/user/login.html';
}

// Display user name
document.getElementById('userName').textContent = user.username;

// Global variables
let allItems = [];
let categories = [];
let isReadOnly = user.role === 'guest';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadInventory();
    loadCategories();
    
    // Show guests link for owners
    if (user.role !== 'guest') {
        const guestsLink = document.getElementById('guestsLink');
        if (guestsLink) {
            guestsLink.style.display = 'inline';
        }
    }
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

// Load Statistics
async function loadStats() {
    try {
        const data = await apiCall('/api/inventory/stats');
        if (data && data.stats) {
            document.getElementById('totalItems').textContent = data.stats.totalItems;
            document.getElementById('totalValue').textContent = '$' + data.stats.totalValue;
            document.getElementById('lowStock').textContent = data.stats.lowStockItems;
            document.getElementById('totalCategories').textContent = data.stats.totalCategories;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load Inventory
async function loadInventory() {
    try {
        const data = await apiCall('/api/inventory');
        if (data && data.items) {
            allItems = data.items;
            isReadOnly = data.isReadOnly || false;
            displayInventory(allItems);
            updateUIForReadOnly();
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        document.getElementById('inventoryTableBody').innerHTML = 
            '<tr><td colspan="9" class="loading-cell">Failed to load inventory</td></tr>';
    }
}

// Update UI for read-only mode
function updateUIForReadOnly() {
    if (isReadOnly) {
        // Hide add button
        const addButton = document.querySelector('.toolbar-actions .btn-primary');
        if (addButton) {
            addButton.style.display = 'none';
        }
        
        // Add read-only badge
        const userName = document.getElementById('userName');
        if (userName && !document.getElementById('readOnlyBadge')) {
            const badge = document.createElement('span');
            badge.id = 'readOnlyBadge';
            badge.style.cssText = 'background: #95a5a6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75em; margin-left: 8px;';
            badge.textContent = 'READ ONLY';
            userName.parentElement.insertBefore(badge, userName.nextSibling);
        }
    }
}

// Display Inventory
function displayInventory(items) {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">No items found. Click "Add Item" to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const totalValue = (item.quantity * item.price).toFixed(2);
        const isLowStock = item.min_quantity > 0 && item.quantity <= item.min_quantity;
        const quantityClass = isLowStock ? 'low-stock' : '';

        return `
            <tr data-id="${item.id}">
                <td>
                    <strong>${escapeHtml(item.name)}</strong>
                    ${item.description ? '<br><small style="color: #7f8c8d;">' + escapeHtml(item.description) + '</small>' : ''}
                </td>
                <td><span class="badge">${escapeHtml(item.category || 'Uncategorized')}</span></td>
                <td><code>${escapeHtml(item.sku || '-')}</code></td>
                <td class="${quantityClass}">
                    <strong>${item.quantity}</strong> 
                    ${isLowStock ? '<span style="color: #e74c3c; font-size: 1.2em;">⚠️</span>' : ''}
                </td>
                <td>${escapeHtml(item.unit)}</td>
                <td><strong>$${item.price.toFixed(2)}</strong></td>
                <td><strong style="color: #27ae60;">$${totalValue}</strong></td>
                <td><span class="badge-location">${escapeHtml(item.location || '-')}</span></td>
                <td class="actions-cell">
                    ${isReadOnly ? '<span style="color: #95a5a6;">View Only</span>' : `
                    <button class="btn btn-small btn-adjust" onclick="showAdjustModal(${item.id})" title="Adjust Quantity">📊</button>
                    <button class="btn btn-small btn-edit" onclick="editItem(${item.id})" title="Edit Item">✏️</button>
                    <button class="btn btn-small btn-delete" onclick="deleteItem(${item.id})" title="Delete Item">🗑️</button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

// Load Categories
async function loadCategories() {
    try {
        const data = await apiCall('/api/categories');
        if (data && data.categories) {
            categories = data.categories;
            
            // Update category filter
            const filterSelect = document.getElementById('categoryFilter');
            const uniqueCategories = [...new Set(allItems.map(item => item.category).filter(c => c))];
            filterSelect.innerHTML = '<option value="">All Categories</option>' + 
                uniqueCategories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');

            // Update category datalist
            const datalist = document.getElementById('categoryList');
            datalist.innerHTML = uniqueCategories.map(cat => `<option value="${escapeHtml(cat)}">`).join('');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Filter Items
function filterItems() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;

    const filtered = allItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.sku && item.sku.toLowerCase().includes(searchTerm));

        const matchesCategory = !categoryFilter || item.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    displayInventory(filtered);
}

// Show Add Item Modal
function showAddItemModal() {
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemModal').style.display = 'block';
}

// Edit Item
function editItem(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemSKU').value = item.sku || '';
    document.getElementById('itemLocation').value = item.location || '';
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemUnit').value = item.unit;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemMinQuantity').value = item.min_quantity;

    document.getElementById('itemModal').style.display = 'block';
}

// Save Item
async function saveItem(event) {
    event.preventDefault();

    const itemData = {
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        category: document.getElementById('itemCategory').value,
        sku: document.getElementById('itemSKU').value,
        location: document.getElementById('itemLocation').value,
        quantity: parseInt(document.getElementById('itemQuantity').value),
        unit: document.getElementById('itemUnit').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        min_quantity: parseInt(document.getElementById('itemMinQuantity').value)
    };

    const itemId = document.getElementById('itemId').value;

    try {
        let response;
        if (itemId) {
            // Update existing item
            response = await apiCall(`/api/inventory/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify(itemData)
            });
        } else {
            // Create new item
            response = await apiCall('/api/inventory', {
                method: 'POST',
                body: JSON.stringify(itemData)
            });
        }

        if (response && response.success) {
            closeModal();
            loadInventory();
            loadStats();
            loadCategories();
        } else {
            alert(response.error || 'Failed to save item');
        }
    } catch (error) {
        console.error('Error saving item:', error);
        alert('Failed to save item');
    }
}

// Show Adjust Modal
function showAdjustModal(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('adjustItemId').value = item.id;
    document.getElementById('adjustItemName').textContent = item.name;
    document.getElementById('currentQuantity').textContent = `${item.quantity} ${item.unit}`;
    document.getElementById('quantityChange').value = '';
    document.getElementById('adjustNotes').value = '';
    document.getElementById('adjustModal').style.display = 'block';
}

// Quick Adjust (Add/Remove 1)
async function quickAdjust(amount) {
    const itemId = document.getElementById('adjustItemId').value;
    const item = allItems.find(i => i.id == itemId);
    
    if (!item) {
        alert('Item not found. Please refresh the page.');
        return;
    }

    // Check if removing would go below 0
    if (amount < 0 && item.quantity + amount < 0) {
        alert('Cannot reduce quantity below 0');
        return;
    }

    const action = amount > 0 ? 'Added' : 'Removed';
    const notes = `${action} ${Math.abs(amount)} unit(s)`;

    try {
        const response = await apiCall(`/api/inventory/${itemId}/adjust`, {
            method: 'POST',
            body: JSON.stringify({ quantity: amount, notes })
        });

        if (response && response.success) {
            // Update the local item and display
            item.quantity = response.newQuantity;
            document.getElementById('currentQuantity').textContent = `${response.newQuantity} ${item.unit}`;
            
            // Reload to sync with server
            loadInventory();
            loadStats();
        } else {
            alert(response.error || 'Failed to adjust quantity');
        }
    } catch (error) {
        console.error('Error adjusting quantity:', error);
        alert('Failed to adjust quantity');
    }
}

// Adjust Quantity (Custom Amount)
async function adjustQuantity(event) {
    event.preventDefault();

    const itemId = document.getElementById('adjustItemId').value;
    const quantityChange = parseInt(document.getElementById('quantityChange').value);
    const notes = document.getElementById('adjustNotes').value;

    if (!quantityChange || quantityChange === 0) {
        alert('Please enter a valid quantity change');
        return;
    }

    try {
        const response = await apiCall(`/api/inventory/${itemId}/adjust`, {
            method: 'POST',
            body: JSON.stringify({ quantity: quantityChange, notes })
        });

        if (response && response.success) {
            closeAdjustModal();
            loadInventory();
            loadStats();
        } else {
            alert(response.error || 'Failed to adjust quantity');
        }
    } catch (error) {
        console.error('Error adjusting quantity:', error);
        alert('Failed to adjust quantity');
    }
}

// Delete Item
async function deleteItem(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
        const response = await apiCall(`/api/inventory/${id}`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            loadInventory();
            loadStats();
        } else {
            alert(response.error || 'Failed to delete item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
    }
}

// Close Modals
function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
}

function closeAdjustModal() {
    document.getElementById('adjustModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const itemModal = document.getElementById('itemModal');
    const adjustModal = document.getElementById('adjustModal');
    if (event.target === itemModal) {
        closeModal();
    }
    if (event.target === adjustModal) {
        closeAdjustModal();
    }
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/start.html';
    }
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
