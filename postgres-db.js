const { Pool } = require('pg');

class PostgresDB {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        this.initialized = false;
    }

    async initialize() {
        try {
            // Create tables if they don't exist
            await this.createTables();
            await this.createDefaultAdmin();
            this.initialized = true;
            console.log('PostgreSQL database initialized successfully');
        } catch (error) {
            console.error('Error initializing PostgreSQL database:', error);
            throw error;
        }
    }

    async createTables() {
        const client = await this.pool.connect();
        try {
            // Users table
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'attendant',
                    shift VARCHAR(10),
                    shift_time VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tools table
            await client.query(`
                CREATE TABLE IF NOT EXISTS tools (
                    id SERIAL PRIMARY KEY,
                    tool_code VARCHAR(100) UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    quantity INTEGER NOT NULL DEFAULT 0,
                    available_quantity INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tool issuances table
            await client.query(`
                CREATE TABLE IF NOT EXISTS tool_issuances (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    tool_code VARCHAR(100) NOT NULL,
                    tool_description TEXT,
                    quantity INTEGER NOT NULL,
                    issued_to_name VARCHAR(255) NOT NULL,
                    issued_to_id VARCHAR(100),
                    department VARCHAR(100) NOT NULL,
                    time_out TIME NOT NULL,
                    time_in TIME,
                    condition_returned VARCHAR(100),
                    attendant_name VARCHAR(255) NOT NULL,
                    attendant_shift VARCHAR(10),
                    shift_day INTEGER,
                    comments TEXT,
                    shift_start_time TIMESTAMP,
                    shift_end_time TIMESTAMP,
                    is_overdue BOOLEAN DEFAULT FALSE,
                    overdue_since TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'issued',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('Database tables created successfully');
        } finally {
            client.release();
        }
    }

    async createDefaultAdmin() {
        const bcrypt = require('bcryptjs');
        const client = await this.pool.connect();
        
        try {
            // Check if admin exists
            const adminCheck = await client.query('SELECT * FROM users WHERE username = $1', ['Kevin Owusu']);
            console.log('Admin check result:', adminCheck.rows.length);
            
            if (adminCheck.rows.length === 0) {
                const hashedPassword = await bcrypt.hash('12448', 10);
                console.log('Creating default admin user...');
                await client.query(
                    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                    ['Kevin Owusu', hashedPassword, 'admin']
                );
                console.log('Default admin user created successfully');
            } else {
                console.log('Default admin user already exists');
            }
        } catch (error) {
            console.error('Error creating default admin:', error);
        } finally {
            client.release();
        }
    }

    // User management methods
    async getUsers() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM users ORDER BY created_at DESC');
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getUserByUsername(username) {
        const client = await this.pool.connect();
        try {
            console.log('Looking up user:', username);
            const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            console.log('Query result rows:', result.rows.length);
            if (result.rows.length > 0) {
                console.log('Found user with role:', result.rows[0].role);
            }
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error in getUserByUsername:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async createUser(userData) {
        const client = await this.pool.connect();
        try {
            const { username, password, role, shift, shift_time } = userData;
            const result = await client.query(
                'INSERT INTO users (username, password, role, shift, shift_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [username, password, role, shift, shift_time]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async deleteUser(userId) {
        const client = await this.pool.connect();
        try {
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
            return true;
        } finally {
            client.release();
        }
    }

    // Tool management methods
    async getTools() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM tools ORDER BY tool_code');
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getToolByCode(toolCode) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM tools WHERE tool_code = $1', [toolCode]);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async createTool(toolData) {
        const client = await this.pool.connect();
        try {
            const { tool_code, description, quantity } = toolData;
            const result = await client.query(
                'INSERT INTO tools (tool_code, description, quantity, available_quantity) VALUES ($1, $2, $3, $3) RETURNING *',
                [tool_code, description, quantity]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async updateToolQuantity(toolCode, quantityChange) {
        const client = await this.pool.connect();
        try {
            await client.query(
                'UPDATE tools SET available_quantity = available_quantity + $1 WHERE tool_code = $2',
                [quantityChange, toolCode]
            );
            return true;
        } finally {
            client.release();
        }
    }

    // Tool issuance methods
    async getToolIssuances() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM tool_issuances ORDER BY created_at DESC');
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getToolIssuancesByAttendant(attendantName) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM tool_issuances WHERE attendant_name = $1 ORDER BY created_at DESC',
                [attendantName]
            );
            return result.rows;
        } finally {
            client.release();
        }
    }

    async createToolIssuance(issuanceData) {
        const client = await this.pool.connect();
        try {
            const {
                date, tool_code, tool_description, quantity, issued_to_name, issued_to_id,
                department, time_out, attendant_name, attendant_shift, shift_day,
                comments, shift_start_time, shift_end_time
            } = issuanceData;

            const result = await client.query(`
                INSERT INTO tool_issuances (
                    date, tool_code, tool_description, quantity, issued_to_name, issued_to_id,
                    department, time_out, attendant_name, attendant_shift, shift_day,
                    comments, shift_start_time, shift_end_time
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
            `, [
                date, tool_code, tool_description, quantity, issued_to_name, issued_to_id,
                department, time_out, attendant_name, attendant_shift, shift_day,
                comments, shift_start_time, shift_end_time
            ]);

            // Update tool available quantity
            await this.updateToolQuantity(tool_code, -quantity);

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async returnTool(issuanceId, returnData) {
        const client = await this.pool.connect();
        try {
            const { time_in, condition_returned } = returnData;
            
            // Get the issuance to know the quantity to return
            const issuanceResult = await client.query('SELECT * FROM tool_issuances WHERE id = $1', [issuanceId]);
            const issuance = issuanceResult.rows[0];
            
            if (!issuance) {
                throw new Error('Tool issuance not found');
            }

            // Update the issuance
            await client.query(
                'UPDATE tool_issuances SET time_in = $1, condition_returned = $2, status = $3 WHERE id = $4',
                [time_in, condition_returned, 'returned', issuanceId]
            );

            // Return quantity to available stock
            await this.updateToolQuantity(issuance.tool_code, issuance.quantity);

            return true;
        } finally {
            client.release();
        }
    }

    // Overdue tools methods
    async getOverdueTools() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    id, tool_code, tool_description, issued_to_name, issued_to_id,
                    department, attendant_name, attendant_shift, shift_day, date,
                    time_out, shift_end_time, overdue_since, quantity, comments,
                    EXTRACT(EPOCH FROM (NOW() - shift_end_time)) / 3600 as hours_overdue
                FROM tool_issuances 
                WHERE is_overdue = true
                ORDER BY overdue_since DESC
            `);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async markToolsOverdue(issuanceIds) {
        const client = await this.pool.connect();
        try {
            const placeholders = issuanceIds.map((_, index) => `$${index + 1}`).join(',');
            await client.query(
                `UPDATE tool_issuances SET is_overdue = true, overdue_since = NOW() WHERE id IN (${placeholders})`,
                issuanceIds
            );
            return true;
        } finally {
            client.release();
        }
    }

    async clearOverdueStatus(issuanceId) {
        const client = await this.pool.connect();
        try {
            await client.query(
                'UPDATE tool_issuances SET is_overdue = false, overdue_since = NULL WHERE id = $1',
                [issuanceId]
            );
            return true;
        } finally {
            client.release();
        }
    }

    // Statistics methods
    async getStatistics() {
        const client = await this.pool.connect();
        try {
            const stats = {};
            
            // Total tools
            const toolsResult = await client.query('SELECT COUNT(*) as count FROM tools');
            stats.totalTools = parseInt(toolsResult.rows[0].count);
            
            // Total attendants
            const attendantsResult = await client.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['attendant']);
            stats.totalAttendants = parseInt(attendantsResult.rows[0].count);
            
            // Issued tools (currently out)
            const issuedResult = await client.query('SELECT COUNT(*) as count FROM tool_issuances WHERE status = $1', ['issued']);
            stats.issuedTools = parseInt(issuedResult.rows[0].count);
            
            // Overdue tools
            const overdueResult = await client.query('SELECT COUNT(*) as count FROM tool_issuances WHERE is_overdue = true');
            stats.overdueTools = parseInt(overdueResult.rows[0].count);
            
            return stats;
        } finally {
            client.release();
        }
    }

    // Close connection
    async close() {
        await this.pool.end();
    }
}

module.exports = new PostgresDB();
