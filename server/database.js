const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Determine which database to use based on environment
const usePostgres = process.env.DATABASE_URL ? true : false;

let db;

if (usePostgres) {
    // PostgreSQL for production (Render)
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    console.log('🐘 Using PostgreSQL database');
} else {
    // SQLite for local development
    const path = require('path');
    const fs = require('fs');
    
    const userInfoDir = path.join(__dirname, '../user_info');
    if (!fs.existsSync(userInfoDir)) {
        fs.mkdirSync(userInfoDir);
    }
    
    const dbPath = path.join(userInfoDir, 'users.db');
    db = new sqlite3.Database(dbPath);
    console.log('📁 Using SQLite database (local)');
}

// Unified query interface
const query = async (sql, params = []) => {
    if (usePostgres) {
        // PostgreSQL
        try {
            const result = await db.query(sql, params);
            return result.rows;
        } catch (error) {
            throw error;
        }
    } else {
        // SQLite
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
};

// Run command (for INSERT, UPDATE, DELETE)
const run = async (sql, params = []) => {
    if (usePostgres) {
        // PostgreSQL
        try {
            const result = await db.query(sql, params);
            return { 
                lastID: result.rows[0]?.id,
                changes: result.rowCount 
            };
        } catch (error) {
            throw error;
        }
    } else {
        // SQLite
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
};

// Get single row
const get = async (sql, params = []) => {
    if (usePostgres) {
        // PostgreSQL
        try {
            const result = await db.query(sql, params);
            return result.rows[0] || null;
        } catch (error) {
            throw error;
        }
    } else {
        // SQLite
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }
};

module.exports = {
    db,
    query,
    run,
    get,
    usePostgres
};
