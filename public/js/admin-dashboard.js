// Admin Dashboard JavaScript
let currentUser = null;
let tools = [];
let users = [];
let issuances = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeNavigation();
    initializeModals();
    
    // Load initial data
    loadDashboardData();
    
    // Generate shift options
    generateShiftOptions();
    
    // Set up periodic refresh for overdue tools (every 5 minutes)
    setInterval(() => {
        if (document.getElementById('dashboard-page').style.display !== 'none') {
            loadDashboardData();
        }
    }, 5 * 60 * 1000);
});

async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
            if (currentUser.role !== 'admin') {
                window.location.href = '/';
                return;
            }
            document.getElementById('currentUser').textContent = `${currentUser.username} (Admin)`;
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        window.location.href = '/';
    }
}

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    
    // Mobile menu toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            sidebar.classList.add('mobile-open');
            mobileOverlay.classList.add('active');
        });
    }
    
    // Sidebar close button
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', function() {
            closeMobileMenu();
        });
    }
    
    // Mobile overlay click to close
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', function() {
            closeMobileMenu();
        });
    }
    
    // Close mobile menu function
    function closeMobileMenu() {
        sidebar.classList.remove('mobile-open');
        mobileOverlay.classList.remove('active');
    }
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            showPage(page);
            
            // Close mobile menu on navigation
            closeMobileMenu();
            
            // Update active nav
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Update page title
            const titles = {
                dashboard: 'Dashboard',
                tools: 'Manage Tools',
                users: 'Manage Attendants',
                issuances: 'Tool Issuances',
                reports: 'Reports',
                help: 'Help & Instructions'
            };
            document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
        });
    });
    
    // Logout functionality for both buttons
    function handleLogout(e) {
        e.preventDefault();
        fetch('/logout', { method: 'POST' })
            .then(() => {
                window.location.href = '/';
            })
            .catch(error => {
                console.error('Logout error:', error);
                window.location.href = '/';
            });
    }
    
    logoutBtn.addEventListener('click', handleLogout);
    
    // Sidebar logout button
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', handleLogout);
    }
}

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('d-none');
    });
    
    // Show selected page
    document.getElementById(`${pageId}-page`).classList.remove('d-none');
    
    // Load page-specific data
    switch(pageId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'tools':
            loadTools();
            break;
        case 'users':
            loadUsers();
            break;
        case 'issuances':
            loadIssuances();
            break;
        case 'reports':
            loadReportFilters();
            break;
    }
}

async function loadDashboardData() {
    try {
        // Load stats
        const [toolsRes, issuancesRes, usersRes, overdueRes] = await Promise.all([
            fetch('/api/admin/tools'),
            fetch('/api/tool-issuances'),
            fetch('/api/admin/users'),
            fetch('/api/overdue-tools')
        ]);
        
        tools = await toolsRes.json();
        issuances = await issuancesRes.json();
        users = await usersRes.json();
        const overdueTools = await overdueRes.json();
        
        // Update stats
        document.getElementById('totalTools').textContent = tools.length;
        document.getElementById('issuedTools').textContent = issuances.filter(i => i.status === 'issued').length;
        document.getElementById('overdueTools').textContent = overdueTools.length;
        document.getElementById('totalAttendants').textContent = users.length;
        
        // Load overdue tools alert
        loadOverdueToolsAlert(overdueTools);
        
        // Load recent issuances
        loadRecentIssuances();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function loadOverdueToolsAlert(overdueTools) {
    const overdueAlert = document.getElementById('overdueAlert');
    const overdueCount = document.getElementById('overdueCount');
    const tbody = document.querySelector('#overdueToolsTable tbody');
    
    if (overdueTools.length > 0) {
        overdueAlert.style.display = 'block';
        overdueCount.textContent = overdueTools.length;
        
        tbody.innerHTML = '';
        overdueTools.forEach(tool => {
            const row = tbody.insertRow();
            const shiftEndDate = new Date(tool.shift_end_time);
            row.innerHTML = `
                <td>
                    <strong>${tool.issued_to_name}</strong><br>
                    <small>ID: ${tool.issued_to_id}</small>
                </td>
                <td>
                    <strong>${tool.tool_code}</strong><br>
                    <small>${tool.tool_description}</small>
                </td>
                <td>${tool.department}</td>
                <td>
                    <span style="color: #e74c3c; font-weight: bold;">
                        ${tool.hours_overdue} hours
                    </span>
                </td>
                <td>
                    ${shiftEndDate.toLocaleDateString()}<br>
                    <small>${shiftEndDate.toLocaleTimeString()}</small>
                </td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="contactEmployee('${tool.issued_to_name}', '${tool.issued_to_id}')">
                        <i class="fas fa-phone"></i> Contact
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="markOverdueAsCleared(${tool.id})">
                        <i class="fas fa-check"></i> Clear
                    </button>
                </td>
            `;
            row.style.backgroundColor = '#fdf2f2';
        });
    } else {
        overdueAlert.style.display = 'none';
    }
}

function contactEmployee(name, id) {
    showAlert(`Contact ${name} (ID: ${id}) about overdue tool return.\n\nRecommended actions:\n- Call employee directly\n- Send reminder message\n- Contact department supervisor`, 'info');
}

function markOverdueAsCleared(issuanceId) {
    showConfirm('Mark this overdue tool as cleared? This action cannot be undone.', () => {
        fetch(`/api/tool-issuances/${issuanceId}/clear-overdue`, {
            method: 'PUT'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadDashboardData();
                showAlert('Overdue status cleared successfully!', 'success');
            } else {
                showAlert('Failed to clear overdue status', 'error');
            }
        })
        .catch(error => {
            console.error('Error clearing overdue status:', error);
            showAlert('Error clearing overdue status', 'error');
        });
    });
}

function getOverdueCount() {
    const now = new Date();
    return issuances.filter(issuance => {
        if (issuance.status !== 'issued') return false;
        
        const issueDate = new Date(issuance.date);
        const timeOut = issuance.time_out;
        const issueDateTime = new Date(`${issuance.date}T${timeOut}`);
        
        // Check if more than 12 hours have passed (shift duration)
        const hoursDiff = (now - issueDateTime) / (1000 * 60 * 60);
        return hoursDiff > 12;
    }).length;
}

function loadRecentIssuances() {
    const tbody = document.querySelector('#recentIssuancesTable tbody');
    const recentIssuances = issuances.slice(0, 10); // Last 10 issuances
    
    tbody.innerHTML = recentIssuances.map(issuance => {
        const isOverdue = isOverdueIssuance(issuance);
        const rowClass = isOverdue ? 'overdue' : '';
        
        return `
            <tr class="${rowClass}">
                <td>${formatDate(issuance.date)}</td>
                <td>${issuance.tool_code} - ${issuance.tool_description}</td>
                <td>${issuance.issued_to_name} (${issuance.issued_to_id})</td>
                <td>${issuance.department}</td>
                <td>${issuance.attendant_name} (${issuance.attendant_shift})</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(issuance.status, isOverdue)}">
                        ${isOverdue ? 'Overdue' : getStatusDisplayText(issuance.status)}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function isOverdueIssuance(issuance) {
    if (issuance.status !== 'issued') return false;
    
    const now = new Date();
    const issueDateTime = new Date(`${issuance.date}T${issuance.time_out}`);
    const hoursDiff = (now - issueDateTime) / (1000 * 60 * 60);
    
    return hoursDiff > 12; // More than 12 hours (shift duration)
}

function getStatusBadgeClass(status, isOverdue) {
    if (isOverdue) return 'badge-danger';
    switch(status) {
        case 'issued': return 'badge-warning';
        case 'returned': return 'badge-success';
        case 'lost': return 'badge-danger';
        case 'damaged': return 'badge-danger';
        default: return 'badge-info';
    }
}

function getStatusDisplayText(status) {
    switch(status) {
        case 'issued': return 'Issued';
        case 'returned': return 'Returned';
        case 'lost': return 'Lost';
        case 'damaged': return 'Damaged';
        default: return status;
    }
}

async function loadTools() {
    try {
        const response = await fetch('/api/admin/tools');
        tools = await response.json();
        
        const tbody = document.querySelector('#toolsTable tbody');
        tbody.innerHTML = tools.map(tool => `
            <tr>
                <td>${tool.tool_code}</td>
                <td>${tool.description}</td>
                <td>${tool.quantity}</td>
                <td>${tool.available_quantity}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editTool(${tool.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading tools:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        users = await response.json();
        
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.shift}</td>
                <td>${user.shift_time === 'morning' ? 'Morning (6:30am-18:30pm)' : 'Evening (18:30pm-6:30am)'}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadIssuances() {
    try {
        const response = await fetch('/api/tool-issuances');
        issuances = await response.json();
        
        const tbody = document.querySelector('#allIssuancesTable tbody');
        tbody.innerHTML = issuances.map(issuance => {
            const isOverdue = isOverdueIssuance(issuance);
            const rowClass = isOverdue ? 'overdue' : '';
            
            return `
                <tr class="${rowClass}">
                    <td>${formatDate(issuance.date)}</td>
                    <td>${issuance.tool_code}</td>
                    <td>${issuance.tool_description}</td>
                    <td>${issuance.quantity}</td>
                    <td>${issuance.issued_to_name} (${issuance.issued_to_id})</td>
                    <td>${issuance.department}</td>
                    <td>${issuance.time_out}</td>
                    <td>${issuance.time_in || '-'}</td>
                    <td>${issuance.condition_returned || '-'}</td>
                    <td>${issuance.attendant_name} (${issuance.attendant_shift})</td>
                    <td>
                        <span class="badge ${getStatusBadgeClass(issuance.status, isOverdue)}">
                            ${isOverdue ? 'Overdue' : getStatusDisplayText(issuance.status)}
                        </span>
                    </td>
                    <td>
                        ${issuance.status === 'issued' ? `
                            <button class="btn btn-success btn-sm" onclick="markReturned(${issuance.id})">
                                <i class="fas fa-check"></i> Mark Returned
                            </button>
                        ` : '-'}
                        ${isOverdue ? `
                            <button class="btn btn-warning btn-sm" onclick="clearOverdue(${issuance.id})">
                                <i class="fas fa-times"></i> Clear Overdue
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading issuances:', error);
    }
}

function loadReportFilters() {
    // Populate shift filter
    const shiftSelect = document.getElementById('reportShift');
    const shifts = [...new Set(users.map(u => u.shift))];
    
    shiftSelect.innerHTML = '<option value="">All Shifts</option>' + 
        shifts.map(shift => `<option value="${shift}">${shift}</option>`).join('');
    
    // Set default dates
    const today = new Date();
    const tenDaysAgo = new Date(today.getTime() - (10 * 24 * 60 * 60 * 1000));
    
    document.getElementById('reportEndDate').value = today.toISOString().split('T')[0];
    document.getElementById('reportStartDate').value = tenDaysAgo.toISOString().split('T')[0];
}

function initializeModals() {
    // Tool Modal
    const toolModal = document.getElementById('toolModal');
    const addToolBtn = document.getElementById('addToolBtn');
    const closeToolModal = document.getElementById('closeToolModal');
    const cancelTool = document.getElementById('cancelTool');
    const toolForm = document.getElementById('toolForm');
    
    addToolBtn.addEventListener('click', () => {
        document.getElementById('toolModalTitle').textContent = 'Add Tool';
        document.getElementById('toolId').value = '';
        toolForm.reset();
        toolModal.style.display = 'block';
    });
    
    closeToolModal.addEventListener('click', () => toolModal.style.display = 'none');
    cancelTool.addEventListener('click', () => toolModal.style.display = 'none');
    
    toolForm.addEventListener('submit', handleToolSubmit);
    
    // User Modal
    const userModal = document.getElementById('userModal');
    const addUserBtn = document.getElementById('addUserBtn');
    const closeUserModal = document.getElementById('closeUserModal');
    const cancelUser = document.getElementById('cancelUser');
    const userForm = document.getElementById('userForm');
    
    addUserBtn.addEventListener('click', () => {
        userForm.reset();
        userModal.style.display = 'block';
    });
    
    closeUserModal.addEventListener('click', () => userModal.style.display = 'none');
    cancelUser.addEventListener('click', () => userModal.style.display = 'none');
    
    userForm.addEventListener('submit', handleUserSubmit);
    
    // Import Modal
    const importModal = document.getElementById('importModal');
    const importToolsBtn = document.getElementById('importToolsBtn');
    const closeImportModal = document.getElementById('closeImportModal');
    const cancelImport = document.getElementById('cancelImport');
    const importForm = document.getElementById('importForm');
    
    importToolsBtn.addEventListener('click', () => {
        importForm.reset();
        importModal.style.display = 'block';
    });
    
    closeImportModal.addEventListener('click', () => importModal.style.display = 'none');
    cancelImport.addEventListener('click', () => importModal.style.display = 'none');
    
    importForm.addEventListener('submit', handleImportSubmit);
    
    // Report buttons
    document.getElementById('generate10DayReport').addEventListener('click', generate10DayReport);
    document.getElementById('generateMonthlyReport').addEventListener('click', generateMonthlyReport);
    document.getElementById('generateCustomReport').addEventListener('click', generateCustomReport);
    document.getElementById('exportIssuancesBtn').addEventListener('click', exportAllIssuances);
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

async function handleToolSubmit(e) {
    e.preventDefault();
    
    const toolId = document.getElementById('toolId').value;
    const toolData = {
        tool_code: document.getElementById('toolCode').value,
        description: document.getElementById('toolDescription').value,
        quantity: parseInt(document.getElementById('toolQuantity').value)
    };
    
    try {
        const url = toolId ? `/api/admin/tools/${toolId}` : '/api/admin/tools';
        const method = toolId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolData)
        });
        
        if (response.ok) {
            document.getElementById('toolModal').style.display = 'none';
            loadTools();
            showAlert('Tool saved successfully!', 'success');
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to save tool', 'error');
        }
    } catch (error) {
        showAlert('Error saving tool', 'error');
    }
}

async function handleUserSubmit(e) {
    e.preventDefault();
    
    const userData = {
        username: document.getElementById('attendantUsername').value,
        password: document.getElementById('attendantPassword').value,
        shift: document.getElementById('attendantShift').value,
        shift_time: document.getElementById('attendantShiftTime').value
    };
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            document.getElementById('userModal').style.display = 'none';
            loadUsers();
            showAlert('Attendant created successfully!', 'success');
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to create attendant', 'error');
        }
    } catch (error) {
        showAlert('Error creating attendant', 'error');
    }
}

async function handleImportSubmit(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('Please select a file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('excel', file);
    
    try {
        const response = await fetch('/api/admin/import-tools', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('importModal').style.display = 'none';
            loadTools();
            showAlert(`Successfully imported ${result.imported} tools!`, 'success');
            
            if (result.errors.length > 0) {
                console.warn('Import errors:', result.errors);
            }
        } else {
            showAlert(result.error || 'Failed to import tools', 'error');
        }
    } catch (error) {
        showAlert('Error importing tools', 'error');
    }
}

function editTool(toolId) {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;
    
    document.getElementById('toolModalTitle').textContent = 'Edit Tool';
    document.getElementById('toolId').value = tool.id;
    document.getElementById('toolCode').value = tool.tool_code;
    document.getElementById('toolDescription').value = tool.description;
    document.getElementById('toolQuantity').value = tool.quantity;
    
    document.getElementById('toolModal').style.display = 'block';
}

async function deleteUser(userId) {
    showConfirm('Are you sure you want to delete this attendant? This action cannot be undone.', async () => {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showAlert('Attendant deleted successfully!', 'success');
                loadUsers();
            } else {
                const error = await response.json();
                showAlert(error.error || 'Failed to delete attendant', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showAlert('Error deleting attendant', 'error');
        }
    });
}

async function markReturned(issuanceId) {
    const timeIn = new Date().toTimeString().slice(0, 5);
    
    showInput('Enter condition of returned tool:', 'Tool Condition', 'Enter condition...', (condition) => {
        if (!condition.trim()) {
            showAlert('Please enter a valid condition', 'error');
            return;
        }
        
        fetch(`/api/tool-issuances/${issuanceId}/return`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ time_in: timeIn, condition_returned: condition })
        })
        .then(response => {
            if (response.ok) {
                loadIssuances();
                showAlert('Tool marked as returned!', 'success');
            } else {
                showAlert('Failed to mark tool as returned', 'error');
            }
        })
        .catch(error => {
            showAlert('Error updating tool status', 'error');
        });
    });
}

async function clearOverdue(issuanceId) {
    showConfirm('Clear overdue status for this tool?', async () => {
        try {
            const response = await fetch(`/api/tool-issuances/${issuanceId}/clear-overdue`, {
                method: 'PUT'
            });
            
            if (response.ok) {
                showAlert('Overdue status cleared successfully!', 'success');
                loadIssuances();
            } else {
                const error = await response.json();
                showAlert(error.error || 'Failed to clear overdue status', 'error');
            }
        } catch (error) {
            console.error('Error clearing overdue status:', error);
            showAlert('Error clearing overdue status', 'error');
        }
    });
}

function generateShiftOptions() {
    const shiftSelect = document.getElementById('attendantShift');
    const shifts = [];
    
    // Generate shifts A-Z
    for (let i = 65; i <= 90; i++) {
        shifts.push(String.fromCharCode(i));
    }
    
    shiftSelect.innerHTML = '<option value="">Select Shift</option>' + 
        shifts.map(shift => `<option value="${shift}">${shift}</option>`).join('');
}

async function generate10DayReport() {
    try {
        showAlert('Generating 10-day report...', 'success');
        
        const response = await fetch('/api/reports/10-day', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Rabotec_10Day_Report_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('10-day report downloaded successfully!', 'success');
        } else {
            const errorText = await response.text();
            console.error('Report generation failed:', errorText);
            showAlert('Failed to generate 10-day report', 'error');
        }
    } catch (error) {
        console.error('Error generating 10-day report:', error);
        showAlert('Error generating 10-day report', 'error');
    }
}

async function generateMonthlyReport() {
    try {
        showAlert('Generating monthly report...', 'success');
        
        const response = await fetch('/api/reports/monthly', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Rabotec_Monthly_Report_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('Monthly report downloaded successfully!', 'success');
        } else {
            const errorText = await response.text();
            console.error('Report generation failed:', errorText);
            showAlert('Failed to generate monthly report', 'error');
        }
    } catch (error) {
        console.error('Error generating monthly report:', error);
        showAlert('Error generating monthly report', 'error');
    }
}

function generateCustomReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const shift = document.getElementById('reportShift').value;
    
    if (!startDate || !endDate) {
        showAlert('Please select both start and end dates', 'error');
        return;
    }
    
    try {
        showAlert('Generating custom report...', 'success');
        const params = new URLSearchParams({
            format: 'pdf',
            startDate,
            endDate,
            ...(shift && { shift })
        });
        window.open(`/api/export/issuances?${params}`, '_blank');
    } catch (error) {
        showAlert('Error generating custom report', 'error');
    }
}

async function exportAllIssuances() {
    try {
        showAlert('Exporting all issuances...', 'success');
        
        const response = await fetch('/api/export/issuances?format=pdf', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Rabotec_All_Issuances_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('All issuances exported successfully!', 'success');
        } else {
            const errorText = await response.text();
            console.error('Export failed:', errorText);
            showAlert('Failed to export issuances', 'error');
        }
    } catch (error) {
        console.error('Error exporting issuances:', error);
        showAlert('Error exporting issuances', 'error');
    }
}

// Initialize modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Alert modal OK button
    document.getElementById('alertModalOk').addEventListener('click', () => {
        document.getElementById('alertModal').style.display = 'none';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        const alertModal = document.getElementById('alertModal');
        const confirmModal = document.getElementById('confirmModal');
        const inputModal = document.getElementById('inputModal');
        
        if (event.target === alertModal) {
            alertModal.style.display = 'none';
        }
        if (event.target === confirmModal) {
            confirmModal.style.display = 'none';
        }
        if (event.target === inputModal) {
            inputModal.style.display = 'none';
        }
    });
});

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

// Custom Alert Modal Functions
function showAlert(message, type = 'info') {
    const modal = document.getElementById('alertModal');
    const header = document.getElementById('alertModalHeader');
    const icon = document.getElementById('alertModalIcon');
    const title = document.getElementById('alertModalTitle');
    const messageEl = document.getElementById('alertModalMessage');
    
    // Set type-specific styling and content
    header.className = `alert-modal-header ${type}`;
    
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle alert-modal-icon';
            title.textContent = 'Success';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-triangle alert-modal-icon';
            title.textContent = 'Error';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-circle alert-modal-icon';
            title.textContent = 'Warning';
            break;
        default:
            icon.className = 'fas fa-info-circle alert-modal-icon';
            title.textContent = 'Information';
    }
    
    messageEl.textContent = message;
    modal.style.display = 'block';
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            modal.style.display = 'none';
        }, 3000);
    }
}

function showConfirm(message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    
    messageEl.textContent = message;
    modal.style.display = 'block';
    
    // Remove existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Add new event listeners
    newConfirmBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    });
    
    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    });
}

function showInput(message, title, placeholder, onSubmit, onCancel = null) {
    const modal = document.getElementById('inputModal');
    const titleEl = document.getElementById('inputModalTitle');
    const labelEl = document.getElementById('inputModalLabel');
    const inputEl = document.getElementById('inputModalInput');
    const submitBtn = document.getElementById('inputModalSubmit');
    const cancelBtn = document.getElementById('inputModalCancel');
    
    titleEl.textContent = title;
    labelEl.textContent = message;
    inputEl.placeholder = placeholder;
    inputEl.value = '';
    modal.style.display = 'block';
    inputEl.focus();
    
    // Remove existing event listeners
    const newSubmitBtn = submitBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Add new event listeners
    newSubmitBtn.addEventListener('click', () => {
        const value = inputEl.value.trim();
        modal.style.display = 'none';
        if (onSubmit) onSubmit(value);
    });
    
    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    });
    
    // Handle Enter key
    inputEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const value = inputEl.value.trim();
            modal.style.display = 'none';
            if (onSubmit) onSubmit(value);
        }
    });
}
