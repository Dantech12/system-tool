# Industrial Tool Management System

A comprehensive tool management audit system designed to track tool inventory, manage issuances, and generate professional reports for industrial operations.

## Features

### Admin Features
- **User Management**: Create tool attendant accounts with shift assignments (A-Z)
- **Tool Management**: Add, edit, and manage tool inventory
- **Excel Import**: Bulk import tools from Excel files
- **Comprehensive Reporting**: Generate 10-day shift reports and monthly audit reports
- **Overdue Tracking**: Monitor and clear overdue tool returns
- **Full System Access**: View all tool issuances across all attendants

### Tool Attendant Features
- **Tool Issuance**: Issue tools with complete tracking information
- **Shift Tracking**: Automatic day/night shift counting
- **Return Management**: Mark tools as returned with condition assessment
- **Personal Records**: View and filter personal issuance history
- **Export Capabilities**: Generate PDF/Excel reports with company branding

### System Features
- **Professional Design**: Modern, responsive interface with company colors
- **Security**: Role-based access control with secure authentication
- **Audit Trail**: Complete tracking of all tool movements
- **Overdue Alerts**: Red highlighting for tools not returned after shift end
- **Company Branding**: All exports include company logo and professional formatting

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   or
   ```bash
   node server.js
   ```

3. **Access the System**
   - Open your browser and go to `http://localhost:3000`
   - Default admin credentials:
     - Username: `admin`
     - Password: `admin123`

## System Structure

### Database Tables
- **users**: Admin and attendant accounts
- **tools**: Tool inventory with quantities
- **tool_issuances**: Complete issuance tracking

### User Roles
- **Admin**: Full system access, user management, reporting
- **Attendant**: Tool issuance, personal records, limited access

### Shift Management
- **Shifts**: A-Z with morning (6:30am-18:30pm) or evening (18:30pm-6:30am) times
- **Automatic Tracking**: System tracks shift days and overdue items
- **Department Categories**: Electrical, Welding, Service Men, Mechanical

## Usage Instructions

### For Administrators
1. **Login** with admin credentials
2. **Manage Tools**: Add tools manually or import from Excel
3. **Create Attendants**: Set up tool attendant accounts with shift assignments
4. **Monitor System**: View dashboard statistics and recent activity
5. **Generate Reports**: Create 10-day, monthly, or custom reports
6. **Handle Overdue Items**: Clear overdue status when tools are returned

### For Tool Attendants
1. **Login** with assigned credentials
2. **Issue Tools**: Fill out the issuance form with all required details
3. **Track Returns**: Mark tools as returned with condition assessment
4. **View Records**: Filter and review personal issuance history
5. **Export Reports**: Generate PDF/Excel reports for shift documentation

### Excel Import Format
For bulk tool import, use Excel files with these columns:
- `tool_code`: Unique identifier for the tool
- `description`: Tool description
- `quantity`: Total quantity available

## Technical Details

### Built With
- **Backend**: Node.js, Express.js, SQLite3
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: Express-session with bcrypt password hashing
- **File Processing**: Multer for uploads, XLSX for Excel processing
- **PDF Generation**: PDFKit for professional report generation
- **Responsive Design**: Mobile-first CSS with modern styling

### Security Features
- Password hashing with bcrypt
- Session-based authentication
- Role-based access control
- Input validation and sanitization
- Secure file upload handling

### Export Features
- **PDF Reports**: Professional formatting with company logo
- **Excel Reports**: Structured data with proper formatting
- **Automatic Naming**: Files named with timestamp for organization
- **Company Branding**: All exports include company branding and attendant information

## File Structure
```
tool-management-system/
├── public/
│   ├── css/styles.css
│   ├── js/
│   │   ├── login.js
│   │   ├── admin-dashboard.js
│   │   └── attendant-dashboard.js
│   ├── images/logo.jpeg
│   ├── login.html
│   ├── admin-dashboard.html
│   └── attendant-dashboard.html
├── uploads/ (for Excel imports)
├── server.js
├── package.json
└── README.md
```

## Support

For technical support or system modifications, contact the system administrator or IT department.

## License

MIT License - Open source tool management system.
