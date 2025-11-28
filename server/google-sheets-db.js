const { google } = require('googleapis');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Google Sheets Database Adapter for RC.INV
 * Provides a database-like interface using Google Sheets as the backend
 */
class GoogleSheetsDB {
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        this.sheets = null;
        this.auth = null;
        
        // Sheet tab names
        this.TABS = {
            USERS: 'USERS',
            INVENTORY: 'INVENTORY',
            SETTINGS: 'SETTINGS',
            GUESTS: 'GUESTS'
        };
    }

    /**
     * Initialize connection to Google Sheets
     */
    async connect() {
        try {
            // Option 1: Use service account JSON file
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                this.auth = new google.auth.GoogleAuth({
                    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });
            }
            // Option 2: Use environment variables
            else if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
                const credentials = {
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
                };
                
                this.auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });
            } else {
                throw new Error('Google Sheets credentials not configured');
            }

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            console.log('✓ Connected to Google Sheets');
            return true;
        } catch (error) {
            console.error('Failed to connect to Google Sheets:', error.message);
            throw error;
        }
    }

    /**
     * Get spreadsheet metadata
     */
    async getSpreadsheetInfo() {
        const response = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId
        });
        return response.data;
    }

    /**
     * Read data from a sheet tab
     */
    async read(tabName, range = null) {
        const fullRange = range ? `${tabName}!${range}` : tabName;
        
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: fullRange
        });

        return response.data.values || [];
    }

    /**
     * Write data to a sheet tab
     */
    async write(tabName, range, values) {
        const response = await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${tabName}!${range}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });

        return response.data;
    }

    /**
     * Append data to a sheet tab
     */
    async append(tabName, values) {
        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: tabName,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });

        return response.data;
    }

    /**
     * Clear data from a sheet tab
     */
    async clear(tabName, range = null) {
        const fullRange = range ? `${tabName}!${range}` : tabName;
        
        const response = await this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: fullRange
        });

        return response.data;
    }

    /**
     * Get all users
     */
    async getUsers() {
        const data = await this.read(this.TABS.USERS);
        if (data.length <= 1) return []; // Only headers or empty

        const headers = data[0];
        const rows = data.slice(1);

        // Header mapping from spreadsheet to code
        const headerMap = {
            'USER_NAME': 'username',
            'PASSCODE': 'password',
            'EMAIL': 'email',
            'USER_ID': 'id',
            'INV_USED': 'inv_used',
            'USER_UNLIMITID': 'has_unlimited',
            'CREATED': 'created_at',
            'LAST_LOGGED_IN': 'last_login',
            'STATUS': 'is_active',
            'ROLE': 'role',
            'OWNER_ID': 'owner_id',
            'ITEM_LIMIT': 'item_limit'
        };

        return rows.map(row => {
            const user = {};
            headers.forEach((header, index) => {
                const mappedKey = headerMap[header] || header.toLowerCase().replace(/_/g, '');
                let value = row[index] || '';
                
                // Convert boolean-like strings
                if (header === 'USER_UNLIMITID') {
                    value = value === 'TRUE' || value === '1' ? 1 : 0;
                } else if (header === 'STATUS') {
                    value = value === 'ACTIVE' || value === '1' ? 1 : 0;
                } else if (header === 'ITEM_LIMIT') {
                    value = parseInt(value) || 20;
                }
                
                user[mappedKey] = value;
            });
            return user;
        });
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username) {
        const users = await this.getUsers();
        return users.find(u => u.username === username);
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        const users = await this.getUsers();
        return users.find(u => u.email === email);
    }

    /**
     * Get guest by username (for login)
     */
    async getGuestByUsername(username) {
        const data = await this.read(this.TABS.GUESTS);
        if (data.length <= 1) return null;

        const headers = data[0];
        const rows = data.slice(1);

        const guestRow = rows.find(row => row[2] === username); // GUEST_NAME is column 2
        if (!guestRow) return null;

        return {
            id: guestRow[1], // GUEST_ID
            username: guestRow[2], // GUEST_NAME
            email: guestRow[3], // EMAIL
            password: guestRow[4], // PASSCODE
            role: 'guest',
            owner_id: guestRow[0], // USER_ID (owner)
            is_active: guestRow[6] === 'TRUE' ? 1 : 0,
            created_at: guestRow[5],
            permission: guestRow[7] || 'read-only', // RANK (permission)
            last_login: guestRow[8] || null, // LAST_LOGGED_IN
            item_limit: 20,
            has_unlimited: 0
        };
    }

    /**
     * Create new user
     */
    async createUser(userData) {
        const timestamp = new Date().toISOString();
        const userId = `U${Date.now()}`;

        // If guest, ONLY add to GUESTS tab (not USERS)
        if (userData.role === 'guest' && userData.owner_id) {
            const guestRow = [
                userData.owner_id,      // USER_ID
                userId,                 // GUEST_ID
                userData.username,      // GUEST_NAME
                userData.email,         // EMAIL
                userData.password,      // PASSCODE (hashed)
                timestamp,              // ADDED_DATE
                'TRUE',                 // ACTIVE
                userData.permission || 'read-only', // RANK (permission)
                ''                      // LAST_LOGGED_IN
            ];
            await this.append(this.TABS.GUESTS, [guestRow]);
            return { id: userId, ...userData, created_at: timestamp };
        }

        // Regular users go to USERS tab
        const userRow = [
            userData.username,
            userData.password, // Should be hashed
            userData.email,
            userId,
            '0', // INV_USED
            userData.has_unlimited ? 'TRUE' : 'FALSE',
            timestamp, // CREATED
            '', // LAST_LOGGED_IN
            userData.is_active ? 'ACTIVE' : 'INACTIVE', // STATUS
            userData.role || 'user', // ROLE
            userData.owner_id || '', // OWNER_ID
            userData.item_limit || '20' // ITEM_LIMIT
        ];

        await this.append(this.TABS.USERS, [userRow]);
        return { id: userId, ...userData, created_at: timestamp };
    }

    /**
     * Update user (or guest)
     */
    async updateUser(userId, updates) {
        // Try users first
        const users = await this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex !== -1) {
            // Found in USERS tab
            const rowNumber = userIndex + 2;
            const data = await this.read(this.TABS.USERS, `A${rowNumber}:L${rowNumber}`);
            const currentRow = data[0] || [];

            const row = [
                updates.username !== undefined ? updates.username : currentRow[0],
                updates.password !== undefined ? updates.password : currentRow[1],
                updates.email !== undefined ? updates.email : currentRow[2],
                currentRow[3], // USER_ID (don't change)
                currentRow[4], // INV_USED
                updates.has_unlimited !== undefined ? (updates.has_unlimited ? 'TRUE' : 'FALSE') : currentRow[5],
                currentRow[6], // CREATED
                updates.last_login !== undefined ? updates.last_login : currentRow[7],
                updates.is_active !== undefined ? (updates.is_active ? 'ACTIVE' : 'INACTIVE') : currentRow[8],
                updates.role !== undefined ? updates.role : currentRow[9],
                updates.owner_id !== undefined ? updates.owner_id : currentRow[10],
                updates.item_limit !== undefined ? updates.item_limit : currentRow[11]
            ];

            await this.write(this.TABS.USERS, `A${rowNumber}:L${rowNumber}`, [row]);
            return { changes: 1 };
        }

        // Try GUESTS tab
        const guestsData = await this.read(this.TABS.GUESTS);
        if (guestsData.length > 1) {
            const guestIndex = guestsData.slice(1).findIndex(row => row[1] === userId);
            if (guestIndex !== -1) {
                const rowNumber = guestIndex + 2;
                const currentRow = guestsData[guestIndex + 1];

                // GUESTS format: USER_ID, GUEST_ID, GUEST_NAME, EMAIL, PASSCODE, ADDED_DATE, ACTIVE, RANK, LAST_LOGGED_IN
                const row = [
                    currentRow[0], // USER_ID (owner)
                    currentRow[1], // GUEST_ID (don't change)
                    updates.username !== undefined ? updates.username : currentRow[2],
                    updates.email !== undefined ? updates.email : currentRow[3],
                    updates.password !== undefined ? updates.password : currentRow[4],
                    currentRow[5], // ADDED_DATE (preserve)
                    updates.is_active !== undefined ? (updates.is_active ? 'TRUE' : 'FALSE') : currentRow[6],
                    updates.permission !== undefined ? updates.permission : (currentRow[7] || 'read-only'), // RANK (permission)
                    updates.last_login !== undefined ? updates.last_login : (currentRow[8] || '') // LAST_LOGGED_IN
                ];

                await this.write(this.TABS.GUESTS, `A${rowNumber}:I${rowNumber}`, [row]);
                return { changes: 1 };
            }
        }

        throw new Error('User or guest not found');
    }

    /**
     * Delete user or guest (permanently delete row from spreadsheet)
     */
    async deleteUser(userId) {
        // Get spreadsheet info for sheet IDs
        const spreadsheetInfo = await this.getSpreadsheetInfo();
        
        // Try users first
        const users = await this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex !== -1) {
            // Permanently delete user row
            const rowNumber = userIndex + 2;
            const usersSheet = spreadsheetInfo.sheets.find(s => s.properties.title === this.TABS.USERS);
            
            if (usersSheet) {
                const sheetId = usersSheet.properties.sheetId;
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    requestBody: {
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: 'ROWS',
                                    startIndex: rowNumber - 1,
                                    endIndex: rowNumber
                                }
                            }
                        }]
                    }
                });
                return { changes: 1 };
            }
        }

        // Try GUESTS tab
        const guestsData = await this.read(this.TABS.GUESTS);
        if (guestsData.length > 1) {
            const guestIndex = guestsData.slice(1).findIndex(row => row[1] === userId);
            if (guestIndex !== -1) {
                // Permanently delete guest row
                const rowNumber = guestIndex + 2;
                const guestsSheet = spreadsheetInfo.sheets.find(s => s.properties.title === this.TABS.GUESTS);
                
                if (guestsSheet) {
                    const sheetId = guestsSheet.properties.sheetId;
                    await this.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.spreadsheetId,
                        requestBody: {
                            requests: [{
                                deleteDimension: {
                                    range: {
                                        sheetId: sheetId,
                                        dimension: 'ROWS',
                                        startIndex: rowNumber - 1,
                                        endIndex: rowNumber
                                    }
                                }
                            }]
                        }
                    });
                    return { changes: 1 };
                }
            }
        }

        return { changes: 0 };
    }

    /**
     * Get inventory items for a user
     */
    async getInventoryByUserId(userId) {
        const data = await this.read(this.TABS.INVENTORY);
        if (data.length <= 1) return [];

        const headers = data[0];
        const rows = data.slice(1);

        // Header mapping
        const headerMap = {
            'USER_ID': 'user_id',
            'DESCRIPTION': 'description',
            'ITEM_NAME': 'name',
            'CATEGORY': 'category',
            'SKU': 'sku',
            'QUANTITY': 'quantity',
            'USED_QUANTITY': 'used_quantity',
            'UNIT': 'unit',
            'PRICE': 'price',
            'TOTAL_VALUE': 'total_value',
            'LOCATION': 'location',
            'MINIMUM_QUANTITY': 'min_quantity',
            'INV_NUMMER': 'id',
            'DATE_ADDED': 'created_at',
            'DATE_UPDATED': 'updated_at',
            'ACTIVE': 'active'
        };

        const userItems = [];
        rows.forEach((row, index) => {
            if (row[0] === userId && row[15] === 'TRUE') { // USER_ID matches and ACTIVE=TRUE (column 15 now)
                const item = {};
                headers.forEach((header, i) => {
                    const mappedKey = headerMap[header] || header.toLowerCase().replace(/_/g, '');
                    let value = row[i] || '';
                    
                    // Convert numeric values (handle both comma and dot as decimal separator)
                    if (['quantity', 'price', 'min_quantity', 'used_quantity'].includes(mappedKey)) {
                        // Replace comma with dot for European format numbers
                        const numStr = String(value).replace(',', '.');
                        value = parseFloat(numStr) || 0;
                    }
                    
                    item[mappedKey] = value;
                });
                item.rowIndex = index + 2; // Store row number for updates
                userItems.push(item);
            }
        });

        return userItems;
    }

    /**
     * Add inventory item
     */
    async addInventoryItem(userId, itemData) {
        const timestamp = new Date().toISOString();
        const invNumber = `INV${Date.now()}`;
        const totalValue = (parseFloat(itemData.quantity || 0) * parseFloat(itemData.price || 0)).toFixed(2);

        const row = [
            userId,
            itemData.description || '',
            itemData.name,
            itemData.category || '',
            itemData.sku || '',
            itemData.quantity || '0',
            itemData.used_quantity || '0', // USED_QUANTITY
            itemData.unit || 'units',
            itemData.price || '0',
            totalValue,
            itemData.location || '',
            itemData.min_quantity || '0',
            invNumber,
            timestamp, // DATE_ADDED
            timestamp, // DATE_UPDATED
            'TRUE' // ACTIVE
        ];

        await this.append(this.TABS.INVENTORY, [row]);
        return { id: invNumber, ...itemData, created_at: timestamp, updated_at: timestamp };
    }

    /**
     * Update inventory item
     */
    async updateInventoryItem(itemId, updates) {
        const timestamp = new Date().toISOString();
        
        // Find the item by INV_NUMMER
        const data = await this.read(this.TABS.INVENTORY);
        if (data.length <= 1) throw new Error('Item not found');
        
        const headers = data[0];
        const invNummerIndex = headers.indexOf('INV_NUMMER');
        const rowIndex = data.slice(1).findIndex(row => row[invNummerIndex] === itemId);
        
        if (rowIndex === -1) throw new Error('Item not found');
        
        const rowNumber = rowIndex + 2;
        const existingRow = data[rowIndex + 1];
        
        const quantity = updates.quantity !== undefined ? updates.quantity : parseFloat(String(existingRow[5] || 0).replace(',', '.'));
        const usedQuantity = updates.used_quantity !== undefined ? updates.used_quantity : parseFloat(String(existingRow[6] || 0).replace(',', '.'));
        const price = updates.price !== undefined ? updates.price : parseFloat(String(existingRow[8] || 0).replace(',', '.'));
        const totalValue = (quantity * price).toFixed(2);

        const row = [
            existingRow[0], // USER_ID (preserve)
            updates.description !== undefined ? updates.description : existingRow[1],
            updates.name !== undefined ? updates.name : existingRow[2],
            updates.category !== undefined ? updates.category : existingRow[3],
            updates.sku !== undefined ? updates.sku : existingRow[4],
            quantity,
            usedQuantity, // USED_QUANTITY
            updates.unit !== undefined ? updates.unit : existingRow[7],
            price,
            totalValue,
            updates.location !== undefined ? updates.location : existingRow[10],
            updates.min_quantity !== undefined ? updates.min_quantity : existingRow[11],
            existingRow[12], // INV_NUMBER (preserve)
            existingRow[13], // DATE_ADDED (preserve)
            timestamp, // DATE_UPDATED
            'TRUE' // ACTIVE
        ];

        await this.write(this.TABS.INVENTORY, `A${rowNumber}:P${rowNumber}`, [row]);
        return { changes: 1 };
    }

    /**
     * Delete inventory item (permanently delete row from spreadsheet)
     */
    async deleteInventoryItem(itemId) {
        // Find the item by INV_NUMMER
        const data = await this.read(this.TABS.INVENTORY);
        if (data.length <= 1) return { changes: 0 };
        
        const headers = data[0];
        const invNummerIndex = headers.indexOf('INV_NUMMER');
        const rowIndex = data.slice(1).findIndex(row => row[invNummerIndex] === itemId);
        
        if (rowIndex === -1) return { changes: 0 };
        
        const rowNumber = rowIndex + 2; // +2 because: +1 for header, +1 for 1-indexed
        
        // Get the sheet ID for the INVENTORY tab
        const spreadsheetInfo = await this.getSpreadsheetInfo();
        const inventorySheet = spreadsheetInfo.sheets.find(s => s.properties.title === this.TABS.INVENTORY);
        
        if (!inventorySheet) {
            throw new Error('INVENTORY sheet not found');
        }
        
        const sheetId = inventorySheet.properties.sheetId;
        
        // Delete the row using batchUpdate
        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowNumber - 1, // 0-indexed for API
                            endIndex: rowNumber // exclusive end
                        }
                    }
                }]
            }
        });
        
        return { changes: 1 };
    }

    /**
     * Get guests for a user
     */
    async getGuestsByUserId(userId) {
        const data = await this.read(this.TABS.GUESTS);
        if (data.length <= 1) return [];

        const rows = data.slice(1);

        return rows
            .filter(row => row[0] === userId && row[6] === 'TRUE') // Filter by owner and active
            .map(row => {
                return {
                    id: row[1], // GUEST_ID
                    username: row[2], // GUEST_NAME
                    email: row[3], // EMAIL
                    created_at: row[5], // ADDED_DATE
                    permission: row[7] || 'read-only', // RANK (permission)
                    last_login: row[8] || null // LAST_LOGGED_IN
                };
            });
    }

    /**
     * Add guest account
     */
    async addGuest(userId, guestData) {
        const timestamp = new Date().toISOString();
        const guestId = `G${Date.now()}`;

        const row = [
            userId,
            guestId,
            guestData.username,
            guestData.email,
            timestamp,
            'TRUE'
        ];

        await this.append(this.TABS.GUESTS, [row]);
        return { guestId, ...guestData, addedDate: timestamp };
    }

    /**
     * Calculate statistics for a user
     */
    async getInventoryStats(userId) {
        const items = await this.getInventoryByUserId(userId);
        // getInventoryByUserId already returns only active items

        const stats = {
            totalItems: items.length,
            totalValue: items.reduce((sum, item) => {
                return sum + (parseFloat(item.quantity || 0) * parseFloat(item.price || 0));
            }, 0).toFixed(2),
            lowStockItems: items.filter(item => {
                const qty = parseFloat(item.quantity || 0);
                const min = parseFloat(item.min_quantity || 0);
                return min > 0 && qty <= min;
            }).length,
            totalCategories: new Set(items.map(i => i.category).filter(c => c)).size
        };

        return stats;
    }
}

// Export singleton instance
let instance = null;

module.exports = {
    GoogleSheetsDB,
    getInstance: async () => {
        if (!instance) {
            instance = new GoogleSheetsDB();
            await instance.connect();
        }
        return instance;
    }
};
