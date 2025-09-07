const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryDB {
    constructor() {
        this.dataFolder = 'rabotec-tool-system';
    }

    // Helper function to upload JSON data to Cloudinary
    async uploadData(filename, data) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const buffer = Buffer.from(jsonString);
            
            const result = await cloudinary.uploader.upload_stream(
                {
                    resource_type: 'raw',
                    public_id: `${this.dataFolder}/${filename}`,
                    format: 'json'
                },
                (error, result) => {
                    if (error) throw error;
                    return result;
                }
            ).end(buffer);
            
            return result;
        } catch (error) {
            console.error('Error uploading data to Cloudinary:', error);
            throw error;
        }
    }

    // Helper function to download JSON data from Cloudinary
    async downloadData(filename) {
        try {
            const url = cloudinary.url(`${this.dataFolder}/${filename}.json`, {
                resource_type: 'raw'
            });
            
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // File doesn't exist
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error downloading data from Cloudinary:', error);
            return null;
        }
    }

    // Initialize database with default data
    async initialize() {
        try {
            // Check if users data exists, if not create default admin
            let users = await this.downloadData('users');
            if (!users) {
                const bcrypt = require('bcryptjs');
                const adminPassword = bcrypt.hashSync('12448', 10);
                users = [{
                    id: 1,
                    username: 'Kevin Owusu',
                    password: adminPassword,
                    role: 'admin',
                    shift: null,
                    shift_time: null,
                    created_at: new Date().toISOString()
                }];
                await this.uploadData('users', users);
            }

            // Initialize empty arrays for other data if they don't exist
            const dataTypes = ['tools', 'tool_issuances'];
            for (const type of dataTypes) {
                const data = await this.downloadData(type);
                if (!data) {
                    await this.uploadData(type, []);
                }
            }

            console.log('Cloudinary database initialized successfully');
        } catch (error) {
            console.error('Error initializing Cloudinary database:', error);
        }
    }

    // Users operations
    async getUsers() {
        return await this.downloadData('users') || [];
    }

    async getUserByUsername(username) {
        const users = await this.getUsers();
        return users.find(user => user.username === username);
    }

    async addUser(userData) {
        const users = await this.getUsers();
        const newId = Math.max(...users.map(u => u.id || 0), 0) + 1;
        const newUser = {
            id: newId,
            ...userData,
            created_at: new Date().toISOString()
        };
        users.push(newUser);
        await this.uploadData('users', users);
        return newUser;
    }

    async deleteUser(userId) {
        const users = await this.getUsers();
        const filteredUsers = users.filter(user => user.id !== userId);
        await this.uploadData('users', filteredUsers);
        return true;
    }

    // Tools operations
    async getTools() {
        return await this.downloadData('tools') || [];
    }

    async getAvailableTools() {
        const tools = await this.getTools();
        return tools.filter(tool => tool.available_quantity > 0);
    }

    async addTool(toolData) {
        const tools = await this.getTools();
        const newId = Math.max(...tools.map(t => t.id || 0), 0) + 1;
        const newTool = {
            id: newId,
            ...toolData,
            available_quantity: toolData.quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        tools.push(newTool);
        await this.uploadData('tools', tools);
        return newTool;
    }

    async updateTool(toolId, updates) {
        const tools = await this.getTools();
        const toolIndex = tools.findIndex(tool => tool.id === toolId);
        if (toolIndex === -1) return null;
        
        tools[toolIndex] = {
            ...tools[toolIndex],
            ...updates,
            updated_at: new Date().toISOString()
        };
        await this.uploadData('tools', tools);
        return tools[toolIndex];
    }

    async updateToolQuantity(toolCode, quantityChange) {
        const tools = await this.getTools();
        const toolIndex = tools.findIndex(tool => tool.tool_code === toolCode);
        if (toolIndex === -1) return false;
        
        tools[toolIndex].available_quantity = Math.max(0, tools[toolIndex].available_quantity + quantityChange);
        tools[toolIndex].updated_at = new Date().toISOString();
        await this.uploadData('tools', tools);
        return true;
    }

    // Tool issuances operations
    async getToolIssuances() {
        return await this.downloadData('tool_issuances') || [];
    }

    async getToolIssuancesByAttendant(attendantName) {
        const issuances = await this.getToolIssuances();
        return issuances.filter(issuance => issuance.attendant_name === attendantName);
    }

    async addToolIssuance(issuanceData) {
        const issuances = await this.getToolIssuances();
        const newId = Math.max(...issuances.map(i => i.id || 0), 0) + 1;
        const newIssuance = {
            id: newId,
            ...issuanceData,
            status: 'issued',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        issuances.push(newIssuance);
        await this.uploadData('tool_issuances', issuances);
        
        // Update tool quantity
        await this.updateToolQuantity(issuanceData.tool_code, -issuanceData.quantity);
        
        return newIssuance;
    }

    async updateToolIssuance(issuanceId, updates) {
        const issuances = await this.getToolIssuances();
        const issuanceIndex = issuances.findIndex(issuance => issuance.id === issuanceId);
        if (issuanceIndex === -1) return null;
        
        const oldIssuance = issuances[issuanceIndex];
        issuances[issuanceIndex] = {
            ...oldIssuance,
            ...updates,
            updated_at: new Date().toISOString()
        };
        
        await this.uploadData('tool_issuances', issuances);
        
        // If returning a tool, update quantity
        if (updates.status === 'returned' && oldIssuance.status === 'issued') {
            await this.updateToolQuantity(oldIssuance.tool_code, oldIssuance.quantity);
        }
        
        return issuances[issuanceIndex];
    }

    async getOverdueTools() {
        const issuances = await this.getToolIssuances();
        const now = new Date();
        
        return issuances.filter(issuance => {
            if (issuance.status !== 'issued' || !issuance.shift_end_time) return false;
            
            const endTime = new Date(issuance.shift_end_time);
            return now > endTime;
        }).map(issuance => {
            const endTime = new Date(issuance.shift_end_time);
            const hoursOverdue = Math.round((now - endTime) / (1000 * 60 * 60) * 10) / 10;
            
            return {
                ...issuance,
                hours_overdue: hoursOverdue
            };
        });
    }
}

module.exports = new CloudinaryDB();
