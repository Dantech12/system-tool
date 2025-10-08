const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const postgresDB = require('./postgres-db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'rabotec-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Changed from production check - HTTPS issues on Render
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize PostgreSQL database
postgresDB.initialize().then(() => {
    console.log('Server starting...');
}).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

// Function to calculate shift times
function calculateShiftTimes(shiftTime, date = new Date()) {
    const shiftDate = new Date(date);
    let startTime, endTime;
    
    if (shiftTime === 'morning') {
        // Morning shift: 6:30 AM to 6:30 PM
        startTime = new Date(shiftDate);
        startTime.setHours(6, 30, 0, 0);
        
        endTime = new Date(shiftDate);
        endTime.setHours(18, 30, 0, 0);
    } else {
        // Evening shift: 6:30 PM to 6:30 AM next day
        startTime = new Date(shiftDate);
        startTime.setHours(18, 30, 0, 0);
        
        endTime = new Date(shiftDate);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(6, 30, 0, 0);
    }
    
    return { startTime, endTime };
}

// Function to check for overdue tools
async function checkOverdueTools() {
    try {
        const now = new Date();
        const issuances = await postgresDB.getToolIssuances();
        
        const overdueItems = issuances.filter(item => {
            if (item.status !== 'issued' || item.is_overdue) return false;
            
            // Check if shift has ended
            if (item.shift_end_time) {
                const shiftEndTime = new Date(item.shift_end_time);
                return now > shiftEndTime;
            }
            return false;
        });
        
        for (const item of overdueItems) {
            item.is_overdue = true;
            item.overdue_since = now.toISOString();
            console.log(`Tool ${item.tool_code} issued to ${item.issued_to_name} is now overdue`);
        }
        
        if (overdueItems.length > 0) {
            const overdueIds = overdueItems.map(item => item.id);
            await postgresDB.markToolsOverdue(overdueIds);
        }
    } catch (error) {
        console.error('Error checking overdue tools:', error);
    }
}

// Function to get overdue tools (legacy - now handled by CloudinaryDB)
async function getOverdueTools() {
    try {
        return await postgresDB.getOverdueTools();
    } catch (error) {
        console.error('Error getting overdue tools:', error);
        return [];
    }
}

// Start overdue checking timer (check every 30 minutes)
setInterval(checkOverdueTools, 30 * 60 * 1000);

// Run initial check
setTimeout(checkOverdueTools, 5000);

// Automatic report generation functions removed to prevent app crashes

// Helper function generatePDFContent removed - was only used for automatic reports

// Automatic report scheduling removed to prevent app crashes
// Reports can still be generated manually through the admin dashboard

// Authentication middleware
const requireAuth = (req, res, next) => {
    console.log('Auth check - Session user:', req.session.user ? 'Present' : 'Missing');
    console.log('Session ID:', req.sessionID);
    
    if (req.session.user) {
        next();
    } else {
        console.log('Authentication failed - redirecting to login');
        if (req.path.includes('/api/')) {
            res.status(401).json({ error: 'Authentication required' });
        } else {
            res.redirect('/');
        }
    }
};

const requireAdmin = (req, res, next) => {
    console.log('Admin check - User role:', req.session.user?.role);
    
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        console.log('Admin access denied');
        res.status(403).json({ error: 'Admin access required' });
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protected dashboard routes
app.get('/admin-dashboard.html', requireAuth, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/attendant-dashboard.html', requireAuth, (req, res) => {
    if (req.session.user.role !== 'attendant') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'attendant-dashboard.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);
    
    try {
        const user = await postgresDB.getUserByUsername(username);
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (user && bcrypt.compareSync(password, user.password)) {
            console.log('Password match: Yes');
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                shift: user.shift,
                shift_time: user.shift_time
            };
            
            // Save session explicitly
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Session error' });
                }
                
                console.log('Session saved successfully for user:', username);
                if (user.role === 'admin') {
                    res.json({ success: true, redirect: '/admin-dashboard.html' });
                } else {
                    res.json({ success: true, redirect: '/attendant-dashboard.html' });
                }
            });
        } else {
            console.log('Password match: No');
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// API endpoint to get overdue tools
app.get('/api/overdue-tools', requireAuth, async (req, res) => {
    try {
        const overdueTools = await postgresDB.getOverdueTools();
        res.json(overdueTools);
    } catch (error) {
        console.error('Error fetching overdue tools:', error);
        res.status(500).json({ error: 'Failed to fetch overdue tools' });
    }
});

// API endpoint to get overdue tools count
app.get('/api/overdue-tools/count', requireAuth, async (req, res) => {
    try {
        const overdueTools = await postgresDB.getOverdueTools();
        res.json({ count: overdueTools.length });
    } catch (error) {
        console.error('Error fetching overdue count:', error);
        res.status(500).json({ error: 'Failed to fetch overdue count' });
    }
});

// Admin routes
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await postgresDB.getUsers();
        const attendants = users.filter(user => user.role === 'attendant');
        res.json(attendants);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const { username, password, shift, shift_time } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    try {
        const newUser = await postgresDB.createUser({
            username,
            password: hashedPassword,
            role: 'attendant',
            shift,
            shift_time
        });
        res.json({ success: true, id: newUser.id });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.get('/api/admin/tools', requireAdmin, async (req, res) => {
    try {
        const tools = await postgresDB.getTools();
        res.json(tools);
    } catch (error) {
        console.error('Error fetching tools:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/tools', requireAdmin, async (req, res) => {
    const { tool_code, description, quantity } = req.body;
    
    try {
        const newTool = await postgresDB.createTool({
            tool_code,
            description,
            quantity
        });
        res.json({ success: true, id: newTool.id });
    } catch (error) {
        console.error('Error adding tool:', error);
        res.status(500).json({ error: 'Failed to add tool' });
    }
});

app.put('/api/admin/tools/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { tool_code, description, quantity } = req.body;
    
    try {
        // Tool update functionality needs to be implemented in PostgreSQL module
        res.status(501).json({ error: 'Tool update not yet implemented' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating tool:', error);
        res.status(500).json({ error: 'Failed to update tool' });
    }
});

// Tool issuance routes
app.get('/api/tools', requireAuth, async (req, res) => {
    try {
        const tools = await postgresDB.getTools();
        res.json(tools);
    } catch (error) {
        console.error('Error fetching tools:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/tool-issuances', requireAuth, async (req, res) => {
    const {
        date, tool_code, tool_description, quantity, issued_to_name, 
        issued_to_id, department, time_out, comments
    } = req.body;
    
    const user = req.session.user;
    
    // Validate required fields
    if (!date || !tool_code || !quantity || !issued_to_name || !department || !time_out) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Ensure user has shift information with defaults
    const userShift = user.shift || 'A';
    const userShiftTime = user.shift_time || 'morning';
    
    // Calculate shift day and times - incremental day counter from attendant creation
    // Get the number of days since this attendant was created
    const attendantCreationDate = new Date(user.created_at || Date.now());
    const shiftDay = Math.floor((Date.now() - attendantCreationDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const issueDate = new Date(date);
    const { startTime, endTime } = calculateShiftTimes(userShiftTime, issueDate);
    
    try {
        const newIssuance = await postgresDB.createToolIssuance({
            date,
            tool_code,
            tool_description: tool_description || '',
            quantity,
            issued_to_name,
            issued_to_id: issued_to_id || '',
            department,
            time_out,
            attendant_name: user.username,
            attendant_shift: userShift,
            shift_day: shiftDay,
            comments: comments || '',
            shift_start_time: startTime.toISOString(),
            shift_end_time: endTime.toISOString()
        });
        
        res.json({ success: true, id: newIssuance.id });
    } catch (error) {
        console.error('Error issuing tool:', error);
        res.status(500).json({ error: 'Failed to issue tool: ' + error.message });
    }
});

app.get('/api/tool-issuances', requireAuth, async (req, res) => {
    try {
        let issuances;
        if (req.session.user.role === 'attendant') {
            issuances = await postgresDB.getToolIssuancesByAttendant(req.session.user.username);
        } else {
            issuances = await postgresDB.getToolIssuances();
        }
        res.json(issuances);
    } catch (error) {
        console.error('Error fetching tool issuances:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/tool-issuances/:id/return', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { time_in, condition_returned, status, comments } = req.body;
    
    // Determine the correct status based on condition
    let finalStatus = status;
    if (!finalStatus) {
        if (condition_returned === 'Lost/Missing') {
            finalStatus = 'lost';
        } else if (condition_returned === 'Damaged') {
            finalStatus = 'damaged';
        } else {
            finalStatus = 'returned';
        }
    }
    
    try {
        await postgresDB.returnTool(parseInt(id), {
            time_in: time_in || null,
            condition_returned,
            status: finalStatus,
            comments: comments || null
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error returning tool:', error);
        res.status(500).json({ error: 'Failed to return tool' });
    }
});

// Excel import route
app.post('/api/admin/import-tools', requireAdmin, upload.single('excel'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
        let data;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        
        if (fileExtension === '.csv') {
            // Handle CSV files
            const csvContent = fs.readFileSync(req.file.path, 'utf8');
            const lines = csvContent.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            
            data = [];
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    data.push(row);
                }
            }
        } else {
            // Handle Excel files
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            data = xlsx.utils.sheet_to_json(worksheet);
        }
        
        let imported = 0;
        let errors = [];
        
        // Process each row sequentially to avoid database conflicts
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            const { tool_code, description, quantity } = row;
            
            if (tool_code && description && quantity) {
                try {
                    // Check if tool already exists
                    const existingTool = await postgresDB.getToolByCode(tool_code);
                    
                    if (existingTool) {
                        // Update existing tool - set both quantity and available_quantity to the new quantity
                        await postgresDB.updateTool(existingTool.id, {
                            tool_code,
                            description,
                            quantity: parseInt(quantity),
                            available_quantity: parseInt(quantity) // Reset available quantity to match total
                        });
                    } else {
                        // Create new tool
                        await postgresDB.createTool({
                            tool_code,
                            description,
                            quantity: parseInt(quantity)
                        });
                    }
                    imported++;
                } catch (err) {
                    errors.push(`Row ${index + 1}: ${err.message}`);
                }
            } else {
                errors.push(`Row ${index + 1}: Missing required fields (tool_code, description, quantity)`);
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, imported, errors });
    } catch (error) {
        console.error('Excel import error:', error);
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
    }
});

// Clear overdue status
app.put('/api/tool-issuances/:id/clear-overdue', requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        await postgresDB.clearOverdueStatus(parseInt(id));
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing overdue status:', error);
        res.status(500).json({ error: 'Failed to clear overdue status' });
    }
});

// Delete user
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        await postgresDB.deleteUser(parseInt(id));
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Export routes
app.get('/api/export/issuances', requireAuth, async (req, res) => {
    try {
        console.log('Export issuances requested by:', req.session.user?.username);
        const { format, startDate, endDate, shift } = req.query;
        
        let issuances;
        
        if (req.session.user.role === 'attendant') {
            // For attendants, get only their issuances
            issuances = await postgresDB.getToolIssuancesByAttendant(req.session.user.username);
        } else {
            // For admins, get all issuances
            issuances = await postgresDB.getToolIssuances();
        }
        
        // Apply date filters if provided
        if (startDate || endDate) {
            issuances = issuances.filter(item => {
                const itemDate = new Date(item.date);
                if (startDate && itemDate < new Date(startDate)) return false;
                if (endDate && itemDate > new Date(endDate)) return false;
                return true;
            });
        }
        
        // Apply shift filter if provided
        if (shift) {
            issuances = issuances.filter(item => item.attendant_shift === shift);
        }
        
        console.log('Filtered issuances count:', issuances.length);
        
        if (format === 'pdf') {
            generatePDFReport(res, issuances, req.session.user);
        } else if (format === 'excel') {
            generateExcelReport(res, issuances, req.session.user);
        } else {
            res.json(issuances);
        }
    } catch (error) {
        console.error('Error exporting issuances:', error);
        res.status(500).json({ error: 'Failed to export issuances: ' + error.message });
    }
});

// Generate reports
app.get('/api/reports/10-day', requireAdmin, async (req, res) => {
    try {
        console.log('10-day report requested by:', req.session.user?.username);
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        
        console.log('Fetching data from:', tenDaysAgo.toISOString(), 'to:', new Date().toISOString());
        const results = await postgresDB.getToolIssuancesByDateRange(tenDaysAgo, new Date());
        console.log('Raw results count:', results.length);
        
        const filteredResults = results.filter(item => 
            (item.condition_returned && ['Damaged', 'Needs Repair', 'Lost/Missing'].includes(item.condition_returned)) ||
            item.status === 'issued'
        );
        console.log('Filtered results count:', filteredResults.length);
        
        if (!res.headersSent) {
            generatePDFReport(res, filteredResults, req.session.user, '10-Day Shift Report');
        }
    } catch (error) {
        console.error('Error generating 10-day report:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate report: ' + error.message });
        }
    }
});

app.get('/api/reports/monthly', requireAdmin, async (req, res) => {
    try {
        console.log('Monthly report requested by:', req.session.user?.username);
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        
        console.log('Fetching monthly data from:', firstDayOfMonth.toISOString());
        const results = await postgresDB.getToolIssuancesByDateRange(firstDayOfMonth, new Date());
        console.log('Monthly results count:', results.length);
        
        if (!res.headersSent) {
            generatePDFReport(res, results, req.session.user, 'Monthly Audit Report');
        }
    } catch (error) {
        console.error('Error generating monthly report:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate report: ' + error.message });
        }
    }
});

// PDF Generation Function
function generatePDFReport(res, data, user, reportTitle = 'Tool Issuance Report') {
    try {
        console.log('Starting PDF generation for:', reportTitle);
        console.log('Data length:', data ? data.length : 0);
        console.log('User:', user ? user.username : 'No user');
        
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        res.setHeader('Content-Disposition', `attachment; filename="Rabotec_Maintenance_Tools_Audit_${timestamp}.pdf"`);
        
        // Pipe the PDF to response
        doc.pipe(res);
        
        console.log('PDF headers set and piped to response');
        
        // Handle empty data case
        if (!data || data.length === 0) {
            console.log('No data provided, creating empty report');
            data = [];
        }
    
        // Add logo (if exists)
        try {
            const fs = require('fs');
            const logoPath = path.join(__dirname, 'public', 'images', 'logo.jpeg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 50, { width: 160, height: 70 });
            } else {
                console.log('Logo file not found at:', logoPath);
            }
        } catch (e) {
            console.log('Logo loading error:', e.message);
        }
    
    // Add header
    doc.fontSize(20).font('Helvetica-Bold');
    doc.text('RABOTEC GHANA LIMITED', 250, 60);
    doc.fontSize(16);
    doc.text('Rabotec Maintenance Tools Audit', 250, 85);
    doc.fontSize(14).font('Helvetica');
    doc.text(reportTitle, 250, 105);
    
    // Add user and date info
    doc.fontSize(12);
    doc.text(`Generated by: ${user.username}${user.shift ? ` (Shift ${user.shift})` : ' (Admin)'}`, 50, 140);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, 155);
    
    if (user.shift) {
        const shiftTime = user.shift_time === 'morning' ? 'Morning (6:30am-18:30pm)' : 'Evening (18:30pm-6:30am)';
        doc.text(`Shift Time: ${shiftTime}`, 50, 170);
    }
    
    // Add table
    let yPosition = 200;
    
    // Table headers with borders
    doc.fontSize(10).font('Helvetica-Bold');
    const headers = ['Date', 'Tool Code', 'Description', 'Qty', 'Issued To', 'Dept', 'Time Out', 'Time In', 'Condition', 'Status'];
    const columnWidths = [60, 70, 120, 30, 80, 50, 50, 50, 60, 50];
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    let xPosition = 50;
    
    // Draw header row with borders
    doc.lineWidth(1);
    doc.strokeColor('#000000');
    doc.fillColor('#f0f0f0');
    doc.rect(50, yPosition - 5, tableWidth, 20).fillAndStroke();
    
    // Draw vertical lines for header
    let currentX = 50;
    for (let i = 0; i <= headers.length; i++) {
        doc.moveTo(currentX, yPosition - 5)
           .lineTo(currentX, yPosition + 15)
           .stroke();
        if (i < headers.length) {
            currentX += columnWidths[i];
        }
    }
    
    // Draw header text
    doc.fillColor('#000000');
    xPosition = 50;
    headers.forEach((header, i) => {
        doc.text(header, xPosition + 2, yPosition, { width: columnWidths[i] - 4 });
        xPosition += columnWidths[i];
    });
    
    yPosition += 20;
    
    // Add message if no data
    if (data.length === 0) {
        doc.fontSize(12).fillColor('#666666');
        doc.text('No tool issuances found for the selected period.', 50, yPosition + 20);
    }
    
    // Table data with borders and highlighting
    doc.font('Helvetica').fontSize(8);
    data.forEach((row, index) => {
        if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
        }
        
        // Check if employee hasn't returned tools (overdue or missing time_in)
        const isOverdue = !row.time_in || row.status === 'overdue' || 
                         (row.time_in === null && isShiftEnded(row, user));
        
        // Set colors
        const borderColor = isOverdue ? '#ff0000' : '#000000';
        const backgroundColor = isOverdue ? '#ffe6e6' : '#ffffff';
        const lineWidth = isOverdue ? 2 : 1;
        
        // Draw row background
        doc.fillColor(backgroundColor);
        doc.rect(50, yPosition - 2, tableWidth, 15).fill();
        
        // Draw row borders
        doc.lineWidth(lineWidth);
        doc.strokeColor(borderColor);
        
        // Top border
        doc.moveTo(50, yPosition - 2)
           .lineTo(50 + tableWidth, yPosition - 2)
           .stroke();
        
        // Bottom border
        doc.moveTo(50, yPosition + 13)
           .lineTo(50 + tableWidth, yPosition + 13)
           .stroke();
        
        // Left border
        doc.moveTo(50, yPosition - 2)
           .lineTo(50, yPosition + 13)
           .stroke();
        
        // Right border
        doc.moveTo(50 + tableWidth, yPosition - 2)
           .lineTo(50 + tableWidth, yPosition + 13)
           .stroke();
        
        // Vertical separators
        let currentX = 50;
        for (let i = 1; i < columnWidths.length; i++) {
            currentX += columnWidths[i - 1];
            doc.moveTo(currentX, yPosition - 2)
               .lineTo(currentX, yPosition + 13)
               .stroke();
        }
        
        // Reset line width
        doc.lineWidth(1);
        
        xPosition = 50;
        const rowData = [
            new Date(row.date).toLocaleDateString(),
            row.tool_code,
            row.tool_description.substring(0, 20) + (row.tool_description.length > 20 ? '...' : ''),
            row.quantity.toString(),
            row.issued_to_name,
            row.department,
            row.time_out,
            row.time_in || '-',
            row.condition_returned || '-',
            row.status
        ];
        
        // Set text color for overdue items
        doc.fillColor(isOverdue ? '#cc0000' : '#000000');
        
        rowData.forEach((cell, i) => {
            doc.text(cell, xPosition + 2, yPosition, { width: columnWidths[i] - 4 });
            xPosition += columnWidths[i];
        });
        
        yPosition += 15;
    });
    
    // Add legend for red highlighting
    yPosition += 20;
    doc.fontSize(10).fillColor('#000000');
    doc.text('Legend:', 50, yPosition);
    doc.fillColor('#ffe6e6');
    doc.strokeColor('#ff0000');
    doc.lineWidth(2);
    doc.rect(100, yPosition - 2, 15, 12).fillAndStroke();
    doc.lineWidth(1);
    doc.fillColor('#000000');
    doc.text('Tools not returned at shift end', 120, yPosition);
    
    // Add footer
    doc.fontSize(8).text('© 2025 Rabotec Ghana Limited. All rights reserved.', 50, doc.page.height - 50);
    
    console.log('Finalizing PDF document');
    doc.end();
    console.log('PDF generation completed successfully');
    } catch (error) {
        console.error('Error in PDF generation:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'PDF generation failed: ' + error.message });
        }
    }
}

// Helper function to check if shift has ended
function isShiftEnded(toolIssuance, user) {
    if (!user.shift_time) return false;
    
    const now = new Date();
    const issueDate = new Date(toolIssuance.date);
    const timeOut = toolIssuance.time_out;
    
    // Parse time_out (format: "HH:MM")
    const [hours, minutes] = timeOut.split(':').map(Number);
    const issueDateTime = new Date(issueDate);
    issueDateTime.setHours(hours, minutes, 0, 0);
    
    // Calculate shift end time
    let shiftEndTime = new Date(issueDateTime);
    if (user.shift_time === 'morning') {
        // Morning shift: 6:30am - 6:30pm
        shiftEndTime.setHours(18, 30, 0, 0);
    } else {
        // Evening shift: 6:30pm - 6:30am (next day)
        shiftEndTime.setDate(shiftEndTime.getDate() + 1);
        shiftEndTime.setHours(6, 30, 0, 0);
    }
    
    return now > shiftEndTime;
}

// Excel Generation Function
function generateExcelReport(res, data, user, reportTitle = 'Tool Issuance Report') {
    const XLSX = require('xlsx');
    
    // Prepare data
    const worksheetData = [
        ['RABOTEC GHANA LIMITED'],
        ['Rabotec Maintenance Tools Audit'],
        [reportTitle],
        [''],
        [`Generated by: ${user.username}${user.shift ? ` (Shift ${user.shift})` : ' (Admin)'}`],
        [`Generated on: ${new Date().toLocaleString()}`],
        user.shift ? [`Shift Time: ${user.shift_time === 'morning' ? 'Morning (6:30am-18:30pm)' : 'Evening (18:30pm-6:30am)'}`] : [''],
        [''],
        ['Date', 'Tool Code/ID', 'Tool Description', 'Quantity', 'Issued To Name/ID', 'Department', 'Time Out', 'Time In', 'Condition Returned', 'Attendant', 'Status']
    ];
    
    // Add data rows
    data.forEach(row => {
        worksheetData.push([
            new Date(row.date).toLocaleDateString(),
            row.tool_code,
            row.tool_description,
            row.quantity,
            `${row.issued_to_name} (${row.issued_to_id})`,
            row.department,
            row.time_out,
            row.time_in || '',
            row.condition_returned || '',
            `${row.attendant_name} (${row.attendant_shift})`,
            row.status
        ]);
    });
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 8 }, { wch: 20 },
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 10 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Tool Audit Report');
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Rabotec_Maintenance_Tools_Audit_${timestamp}.xlsx"`);
    
    res.send(buffer);
}

// Get current user info
app.get('/api/user', requireAuth, (req, res) => {
    res.json(req.session.user);
});

app.listen(PORT, () => {
    console.log(`Rabotec Tool Management System running on port ${PORT}`);
    console.log(`Access the system at: http://localhost:${PORT}`);
});
