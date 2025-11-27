# Developer Guide - Using Shared Utilities

## Quick Reference for js/utils.js

### Authentication Helper

```javascript
// Check authentication and get user
const user = requireAuth();
if (!user) return; // Will auto-redirect if not authenticated

// Display user info
displayUserName(user.username);
showAdminLink(user.role);
```

### API Calls

```javascript
// GET request
const data = await apiCall('/api/inventory');
if (!data) return; // Auth failed, user redirected

// POST request
const response = await apiCall('/api/inventory', {
    method: 'POST',
    body: JSON.stringify({ name: 'Item', quantity: 10 })
});

// DELETE request
const result = await apiCall(`/api/inventory/${id}`, {
    method: 'DELETE'
});
```

### Utility Functions

```javascript
// Escape HTML to prevent XSS
const safe = escapeHtml(userInput);
element.innerHTML = safe;

// Format dates consistently
const formatted = formatDate('2025-11-27T10:30:00Z');
// Output: "11/27/2025 10:30:00 AM"

// Logout user
logout(); // Shows confirmation and redirects
```

## Example Usage in New Page

```javascript
// 1. Include the utility script in your HTML
<script src="/js/utils.js"></script>

// 2. Use in your JavaScript
const user = requireAuth();
displayUserName(user.username);

// 3. Make API calls
async function loadData() {
    const data = await apiCall('/api/your-endpoint');
    if (data && data.items) {
        displayItems(data.items);
    }
}

// 4. Safe HTML rendering
function displayItems(items) {
    const html = items.map(item => 
        `<div>${escapeHtml(item.name)}</div>`
    ).join('');
    container.innerHTML = html;
}
```

## Benefits

✅ **Consistent Error Handling**: Auth failures handled automatically  
✅ **DRY Code**: No duplicate authentication checks  
✅ **Security**: Built-in XSS protection with escapeHtml  
✅ **Maintainability**: Update once, apply everywhere  
✅ **Type Safety**: JSDoc comments for better IDE support

## Migration Guide

### Before (Old Pattern)
```javascript
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || !user.username) {
    window.location.href = '/user/login.html';
}

async function loadData() {
    const response = await fetch('/api/data', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (response.status === 401) {
        alert('Session expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/user/login.html';
        return;
    }
    
    return response.json();
}
```

### After (New Pattern)
```javascript
const user = requireAuth();

async function loadData() {
    return await apiCall('/api/data');
}
```

**Lines Saved**: ~15 lines per file  
**Maintenance**: Centralized in one place  
**Consistency**: Same behavior everywhere
