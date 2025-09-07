const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const cloudinaryDB = require('./cloudinary-db');

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
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize Cloudinary database
cloudinaryDB.initialize();

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
        const issuances = await cloudinaryDB.getToolIssuances();
        
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
            await cloudinaryDB.updateToolIssuances(issuances);
        }
    } catch (error) {
        console.error('Error checking overdue tools:', error);
    }
}

// Function to get overdue tools (legacy - now handled by CloudinaryDB)
async function getOverdueTools() {
    try {
        return await cloudinaryDB.getOverdueTools();
    } catch (error) {
        console.error('Error getting overdue tools:', error);
        return [];
    }
}

// Start overdue checking timer (check every 30 minutes)
setInterval(checkOverdueTools, 30 * 60 * 1000);

// Run initial check
setTimeout(checkOverdueTools, 5000);

// Automatic report generation functions
function generateAutomaticReports() {
    const fs = require('fs');
    const path = require('path');
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir);
    }
    
    console.log('Generating automatic reports...');
    
    // Generate 10-day shift reports for all attendants
    db.all('SELECT * FROM users WHERE role = "attendant"', (err, attendants) => {
        if (!err && attendants.length > 0) {
            attendants.forEach(attendant => {
                const tenDaysAgo = new Date();
                tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                
                db.all(`
                    SELECT ti.*, t.description as tool_description 
                    FROM tool_issuances ti 
                    LEFT JOIN tools t ON ti.tool_code = t.tool_code 
                    WHERE ti.attendant_name = ? AND ti.date >= ? 
                    ORDER BY ti.date DESC
                `, [attendant.username, tenDaysAgo.toISOString().split('T')[0]], (err, data) => {
                    if (!err && data.length > 0) {
                        const fileName = `10-day-report-${attendant.username.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
                        const filePath = path.join(reportsDir, fileName);
                        
                        // Generate PDF report
                        const PDFDocument = require('pdfkit');
                        const doc = new PDFDocument({ margin: 50 });
                        const stream = fs.createWriteStream(filePath);
                        doc.pipe(stream);
                        
                        generatePDFContent(doc, data, attendant, `10-Day Shift Report - ${attendant.username}`);
                        doc.end();
                        
                        console.log(`Generated 10-day report for ${attendant.username}: ${fileName}`);
                    }
                });
            });
        }
    });
    
    // Generate monthly admin report
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    
    db.all(`
        SELECT ti.*, t.description as tool_description, u.username as attendant_name 
        FROM tool_issuances ti 
        LEFT JOIN tools t ON ti.tool_code = t.tool_code 
        LEFT JOIN users u ON ti.attendant_name = u.username 
        WHERE ti.date >= ? 
        ORDER BY ti.date DESC
    `, [firstDayOfMonth.toISOString().split('T')[0]], (err, data) => {
        if (!err && data.length > 0) {
            const fileName = `monthly-admin-report-${new Date().toISOString().split('T')[0]}.pdf`;
            const filePath = path.join(reportsDir, fileName);
            
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);
            
            const adminUser = { username: 'System', role: 'admin' };
            generatePDFContent(doc, data, adminUser, 'Monthly Admin Report');
            doc.end();
            
            console.log(`Generated monthly admin report: ${fileName}`);
        }
    });
}

// Helper function to generate PDF content
function generatePDFContent(doc, data, user, reportTitle) {
    // Add logo placeholder
    doc.rect(50, 50, 170, 70).stroke();
    doc.fontSize(10).text('LOGO', 125, 80);
    
    // Add header
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text('RABOTEC GHANA LIMITED', 250, 50);
    doc.fontSize(16);
    doc.text('Rabotec Maintenance Tools Audit', 250, 85);
    doc.fontSize(14).font('Helvetica');
    doc.text(reportTitle, 250, 105);
    
    // Add user and date info
    doc.fontSize(12);
    doc.text(`Generated by: ${user.username}${user.shift ? ` (Shift ${user.shift})` : ' (Admin)'}`, 50, 140);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, 155);
    doc.text(`Total Records: ${data.length}`, 50, 170);
    
    // Add table headers
    let yPosition = 200;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Date', 50, yPosition);
    doc.text('Tool Code', 100, yPosition);
    doc.text('Description', 160, yPosition);
    doc.text('Qty', 280, yPosition);
    doc.text('Issued To', 310, yPosition);
    doc.text('Dept', 380, yPosition);
    doc.text('Status', 420, yPosition);
    doc.text('Time Out', 460, yPosition);
    doc.text('Time In', 510, yPosition);
    
    // Add line under headers
    yPosition += 15;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    
    // Add data rows
    doc.font('Helvetica');
    data.forEach((row, index) => {
        yPosition += 20;
        
        // Check if we need a new page
        if (yPosition > 750) {
            doc.addPage();
            yPosition = 50;
        }
        
        doc.text(row.date || '', 50, yPosition);
        doc.text(row.tool_code || '', 100, yPosition);
        doc.text((row.tool_description || '').substring(0, 15), 160, yPosition);
        doc.text(row.quantity?.toString() || '', 280, yPosition);
        doc.text((row.issued_to || '').substring(0, 12), 310, yPosition);
        doc.text((row.department || '').substring(0, 8), 380, yPosition);
        doc.text(row.status || '', 420, yPosition);
        doc.text(row.time_out || '', 460, yPosition);
        doc.text(row.time_in || '', 510, yPosition);
    });
}

// Schedule automatic report generation
// Run every 10 days at 2 AM for 10-day reports
const tenDayInterval = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds
setInterval(generateAutomaticReports, tenDayInterval);

// Run monthly on the 1st of each month at 2 AM
function scheduleMonthlyReports() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0); // 1st of next month at 2 AM
    const timeUntilNextMonth = nextMonth.getTime() - now.getTime();
    
    setTimeout(() => {
        generateAutomaticReports();
        // Schedule for subsequent months
        setInterval(generateAutomaticReports, 30 * 24 * 60 * 60 * 1000); // Approximately monthly
    }, timeUntilNextMonth);
}

scheduleMonthlyReports();

// Run initial report generation after 10 seconds (for testing)
setTimeout(generateAutomaticReports, 10000);

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
};

const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await cloudinaryDB.getUserByUsername(username);
        
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                shift: user.shift,
                shift_time: user.shift_time
            };
            
            if (user.role === 'admin') {
                res.json({ success: true, redirect: '/admin-dashboard.html' });
            } else {
                res.json({ success: true, redirect: '/attendant-dashboard.html' });
            }
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// API endpoint to get overdue tools
app.get('/api/overdue-tools', requireAuth, async (req, res) => {
    try {
        const overdueTools = await cloudinaryDB.getOverdueTools();
        res.json(overdueTools);
    } catch (error) {
        console.error('Error fetching overdue tools:', error);
        res.status(500).json({ error: 'Failed to fetch overdue tools' });
    }
});

// API endpoint to get overdue tools count
app.get('/api/overdue-tools/count', requireAuth, async (req, res) => {
    try {
        const overdueTools = await cloudinaryDB.getOverdueTools();
        res.json({ count: overdueTools.length });
    } catch (error) {
        console.error('Error fetching overdue count:', error);
        res.status(500).json({ error: 'Failed to fetch overdue count' });
    }
});

// Admin routes
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await cloudinaryDB.getUsers();
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
        const newUser = await cloudinaryDB.addUser({
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
        const tools = await cloudinaryDB.getTools();
        res.json(tools);
    } catch (error) {
        console.error('Error fetching tools:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/admin/tools', requireAdmin, async (req, res) => {
    const { tool_code, description, quantity } = req.body;
    
    try {
        const newTool = await cloudinaryDB.addTool({
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
        const updatedTool = await cloudinaryDB.updateTool(parseInt(id), {
            tool_code,
            description,
            quantity
        });
        
        if (!updatedTool) {
            return res.status(404).json({ error: 'Tool not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating tool:', error);
        res.status(500).json({ error: 'Failed to update tool' });
    }
});

// Tool issuance routes
app.get('/api/tools', requireAuth, async (req, res) => {
    try {
        const tools = await cloudinaryDB.getAvailableTools();
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
    
    // Calculate shift day and times
    const shiftDay = Math.floor((Date.now() - new Date(user.created_at || Date.now()).getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const issueDate = new Date(date);
    const { startTime, endTime } = calculateShiftTimes(userShiftTime, issueDate);
    
    try {
        const newIssuance = await cloudinaryDB.addToolIssuance({
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
            issuances = await cloudinaryDB.getToolIssuancesByAttendant(req.session.user.username);
        } else {
            issuances = await cloudinaryDB.getToolIssuances();
        }
        res.json(issuances);
    } catch (error) {
        console.error('Error fetching tool issuances:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/tool-issuances/:id/return', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { time_in, condition_returned } = req.body;
    
    try {
        const updatedIssuance = await cloudinaryDB.updateToolIssuance(parseInt(id), {
            time_in,
            condition_returned,
            status: 'returned'
        });
        
        if (!updatedIssuance) {
            return res.status(404).json({ error: 'Tool issuance not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error returning tool:', error);
        res.status(500).json({ error: 'Failed to return tool' });
    }
});

// Excel import route
app.post('/api/admin/import-tools', requireAdmin, upload.single('excel'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);
        
        let imported = 0;
        let errors = [];
        
        data.forEach((row, index) => {
            const { tool_code, description, quantity } = row;
            
            if (tool_code && description && quantity) {
                db.run('INSERT OR REPLACE INTO tools (tool_code, description, quantity, available_quantity) VALUES (?, ?, ?, ?)',
                       [tool_code, description, quantity, quantity], function(err) {
                    if (!err) imported++;
                    else errors.push(`Row ${index + 1}: ${err.message}`);
                });
            }
        });
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, imported, errors });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process Excel file' });
    }
});

// Clear overdue status
app.put('/api/tool-issuances/:id/clear-overdue', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE tool_issuances SET status = "cleared_overdue", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
           [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to clear overdue status' });
        }
        res.json({ success: true });
    });
});

// Delete user
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM users WHERE id = ? AND role = "attendant"', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete user' });
        }
        res.json({ success: true });
    });
});

// Export routes
app.get('/api/export/issuances', requireAuth, (req, res) => {
    const { format, startDate, endDate, shift } = req.query;
    
    let query = 'SELECT * FROM tool_issuances WHERE 1=1';
    let params = [];
    
    if (req.session.user.role === 'attendant') {
        query += ' AND attendant_name = ?';
        params.push(req.session.user.username);
    }
    
    if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
    }
    
    if (shift) {
        query += ' AND attendant_shift = ?';
        params.push(shift);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, issuances) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (format === 'pdf') {
            generatePDFReport(res, issuances, req.session.user);
        } else if (format === 'excel') {
            generateExcelReport(res, issuances, req.session.user);
        } else {
            res.json(issuances);
        }
    });
});

// Generate reports
app.get('/api/reports/10-day', requireAdmin, (req, res) => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    const query = `
        SELECT * FROM tool_issuances 
        WHERE date >= ? AND (condition_returned IN ('Damaged', 'Needs Repair', 'Lost/Missing') OR status = 'issued')
        ORDER BY date DESC
    `;
    
    db.all(query, [tenDaysAgo.toISOString().split('T')[0]], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        generatePDFReport(res, results, req.session.user, '10-Day Shift Report');
    });
});

app.get('/api/reports/monthly', requireAdmin, (req, res) => {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    
    const query = 'SELECT * FROM tool_issuances WHERE date >= ? ORDER BY date DESC';
    
    db.all(query, [firstDayOfMonth.toISOString().split('T')[0]], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        generatePDFReport(res, results, req.session.user, 'Monthly Audit Report');
    });
});

// PDF Generation Function
function generatePDFReport(res, data, user, reportTitle = 'Tool Issuance Report') {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    res.setHeader('Content-Disposition', `attachment; filename="Rabotec_Maintenance_Tools_Audit_${timestamp}.pdf"`);
    
    // Pipe the PDF to response
    doc.pipe(res);
    
    // Add logo (if exists)
    try {
        doc.image('public/images/logo.jpeg', 50, 50, { width: 160, height: 70 });
    } catch (e) {
        console.log('Logo not found, skipping...');
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
    doc.fontSize(8).text('© 2024 Rabotec Ghana Limited. All rights reserved.', 50, doc.page.height - 50);
    
    doc.end();
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
