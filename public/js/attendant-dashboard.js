// Attendant Dashboard JavaScript
let currentUser = null;
let tools = [];
let myIssuances = [];
let shiftDay = 1;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuth();
    
    // Initialize navigation
    initializeNavigation();
    
    // Initialize forms and modals
    initializeForms();
    
    // Load initial data
    loadDashboardData();
    
    // Set current date and time
    setCurrentDateTime();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
            if (currentUser.role !== 'attendant') {
                window.location.href = '/';
                return;
            }
            
            // Update user info displays
            document.getElementById('currentUser').textContent = `${currentUser.username} (${currentUser.shift})`;
            updateAttendantInfo();
            
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        window.location.href = '/';
    }
}

function checkUserSession() {
    // Alias for checkAuth to maintain compatibility
    return checkAuth();
}

function updateAttendantInfo() {
    const shiftTime = currentUser.shift_time === 'morning' ? 
        'Morning (6:30am - 18:30pm)' : 'Evening (18:30pm - 6:30am)';
    
    // Calculate shift day (simplified calculation)
    const today = new Date();
    const startDate = new Date(currentUser.created_at || today);
    const daysDiff = Math.floor((today - startDate) / (24 * 60 * 60 * 1000));
    shiftDay = daysDiff + 1;
    
    const shiftType = currentUser.shift_time === 'morning' ? 'Day' : 'Night';
    
    document.getElementById('attendantInfo').textContent = `${currentUser.username} - Shift ${currentUser.shift}`;
    document.getElementById('shiftInfo').textContent = `${shiftType} ${shiftDay} - ${shiftTime}`;
    
    document.getElementById('formAttendantInfo').textContent = `Attendant: ${currentUser.username} - Shift ${currentUser.shift}`;
    document.getElementById('formShiftInfo').textContent = `${shiftType} ${shiftDay} - ${shiftTime}`;
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
                issuance: 'Tool Issuance',
                'my-records': 'My Records',
                'tools-list': 'Available Tools'
            };
            document.getElementById('pageTitle').textContent = titles[page] || 'Tool Issuance';
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
    
    // Update sidebar user info for attendants
    if (currentUser) {
        const sidebarUserName = document.getElementById('sidebarUserName');
        if (sidebarUserName) {
            sidebarUserName.textContent = currentUser.username || 'Loading...';
        }
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
        case 'issuance':
            loadTools();
            loadShiftSummary();
            break;
        case 'my-records':
            loadMyRecords();
            break;
        case 'tools-list':
            loadAvailableTools();
            break;
    }
}

function initializeForms() {
    // Tool issuance form
    const issuanceForm = document.getElementById('issuanceForm');
    const toolCodeSelect = document.getElementById('toolCode');
    const clearFormBtn = document.getElementById('clearForm');
    
    issuanceForm.addEventListener('submit', handleIssuanceSubmit);
    toolCodeSelect.addEventListener('change', handleToolSelection);
    clearFormBtn.addEventListener('click', clearIssuanceForm);
    
    // Return modal handlers
    document.getElementById('cancelReturn').addEventListener('click', () => {
        document.getElementById('returnModal').style.display = 'none';
    });
    
    document.getElementById('closeReturnModal').addEventListener('click', () => {
        document.getElementById('returnModal').style.display = 'none';
    });
    
    // Add condition change handler
    document.getElementById('conditionReturned').addEventListener('change', handleConditionChange);
    
    document.getElementById('returnForm').addEventListener('submit', handleReturnTool);
    
    // Export buttons
    document.getElementById('exportRecordsBtn').addEventListener('click', exportAllRecords);
    document.getElementById('exportMyRecordsBtn').addEventListener('click', () => exportMyRecords('pdf'));
    document.getElementById('exportMyRecordsExcelBtn').addEventListener('click', () => exportMyRecords('excel'));
    
    // Filter functionality
    document.getElementById('applyFilter').addEventListener('click', applyDateFilter);
    
    // Tool search
    document.getElementById('toolSearch').addEventListener('input', handleToolSearch);
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

function setCurrentDateTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    document.getElementById('issueDate').value = today;
    document.getElementById('timeOut').value = currentTime;
    
    // Set filter dates to show current month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('filterStartDate').value = firstDay;
    document.getElementById('filterEndDate').value = today;
}

async function loadDashboardData() {
    await Promise.all([
        loadTools(),
        loadMyRecords(),
        loadShiftSummary()
    ]);
}

async function loadTools() {
    try {
        const response = await fetch('/api/tools');
        tools = await response.json();
        
        // Populate tool select
        const toolSelect = document.getElementById('toolCode');
        toolSelect.innerHTML = '<option value="">Select Tool</option>' + 
            tools.map(tool => `
                <option value="${tool.tool_code}" data-description="${tool.description}" data-available="${tool.available_quantity}">
                    ${tool.tool_code} - ${tool.description} (Available: ${tool.available_quantity})
                </option>
            `).join('');
            
    } catch (error) {
        console.error('Error loading tools:', error);
        showAlert('Error loading tools', 'error');
    }
}

async function loadMyRecords() {
    try {
        const response = await fetch('/api/tool-issuances');
        myIssuances = await response.json();
        
        displayMyRecords(myIssuances);
        
    } catch (error) {
        console.error('Error loading records:', error);
        showAlert('Error loading records', 'error');
    }
}

function displayMyRecords(records) {
    const tbody = document.querySelector('#myRecordsTable tbody');
    
    tbody.innerHTML = records.map(issuance => {
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
                <td>
                    <span class="badge ${getStatusBadgeClass(issuance.status, isOverdue)}">
                        ${isOverdue ? 'Overdue' : issuance.status}
                    </span>
                </td>
                <td>
                    ${issuance.status === 'issued' ? `
                        <button class="btn btn-success btn-sm" onclick="openReturnModal(${issuance.id})">
                            <i class="fas fa-undo"></i> Return
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

async function loadAvailableTools() {
    const tbody = document.querySelector('#availableToolsTable tbody');
    
    tbody.innerHTML = tools.map(tool => {
        const status = tool.available_quantity > 0 ? 'Available' : 'Out of Stock';
        const statusClass = tool.available_quantity > 0 ? 'badge-success' : 'badge-danger';
        
        return `
            <tr>
                <td>${tool.tool_code}</td>
                <td>${tool.description}</td>
                <td>${tool.quantity}</td>
                <td>${tool.available_quantity}</td>
                <td>
                    <span class="badge ${statusClass}">${status}</span>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadShiftSummary() {
    try {
        // Ensure we have fresh data
        if (!myIssuances || myIssuances.length === 0) {
            const response = await fetch('/api/tool-issuances');
            if (response.ok) {
                myIssuances = await response.json();
            } else {
                console.error('Failed to fetch issuances for summary');
                return;
            }
        }
        
        const today = new Date().toISOString().split('T')[0];
        const todayIssuances = myIssuances.filter(i => {
            const issueDate = new Date(i.date).toISOString().split('T')[0];
            return issueDate === today;
        });
        
        const issuedToday = todayIssuances.length;
        const returnedToday = todayIssuances.filter(i => i.status === 'returned' || i.time_in).length;
        const pendingReturns = myIssuances.filter(i => i.status === 'issued' && !i.time_in).length;
        const overdueReturns = myIssuances.filter(i => isOverdueIssuance(i)).length;
        
        // Update the display elements
        const shiftIssuancesEl = document.getElementById('shiftIssuances');
        const shiftReturnsEl = document.getElementById('shiftReturns');
        const shiftPendingEl = document.getElementById('shiftPending');
        const shiftOverdueEl = document.getElementById('shiftOverdue');
        
        if (shiftIssuancesEl) shiftIssuancesEl.textContent = issuedToday;
        if (shiftReturnsEl) shiftReturnsEl.textContent = returnedToday;
        if (shiftPendingEl) shiftPendingEl.textContent = pendingReturns;
        if (shiftOverdueEl) shiftOverdueEl.textContent = overdueReturns;
        
        console.log('Shift summary updated:', {
            issuedToday,
            returnedToday,
            pendingReturns,
            overdueReturns,
            totalRecords: myIssuances.length
        });
        
    } catch (error) {
        console.error('Error loading shift summary:', error);
        // Set default values on error
        const elements = ['shiftIssuances', 'shiftReturns', 'shiftPending', 'shiftOverdue'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
    }
}

function handleToolSelection() {
    const select = document.getElementById('toolCode');
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption.value) {
        const description = selectedOption.dataset.description;
        const available = selectedOption.dataset.available;
        
        document.getElementById('toolDescription').value = description;
        document.getElementById('availableQuantity').textContent = available;
        document.getElementById('quantity').max = available;
        document.getElementById('quantity').value = 1;
    } else {
        document.getElementById('toolDescription').value = '';
        document.getElementById('availableQuantity').textContent = '0';
        document.getElementById('quantity').value = '';
        document.getElementById('quantity').max = '';
    }
}

async function handleIssuanceSubmit(e) {
    e.preventDefault();
    
    const formData = {
        date: document.getElementById('issueDate').value,
        tool_code: document.getElementById('toolCode').value,
        tool_description: document.getElementById('toolDescription').value,
        quantity: parseInt(document.getElementById('quantity').value),
        issued_to_name: document.getElementById('issuedToName').value,
        issued_to_id: document.getElementById('issuedToId').value,
        department: document.getElementById('department').value,
        time_out: document.getElementById('timeOut').value,
        comments: document.getElementById('comments').value
    };
    
    // Validate quantity
    const availableQty = parseInt(document.getElementById('availableQuantity').textContent);
    if (formData.quantity > availableQty) {
        showAlert(`Only ${availableQty} units available for this tool`, 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/tool-issuances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showAlert('Tool issued successfully!', 'success');
            clearIssuanceForm();
            loadDashboardData(); // Refresh all data
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to issue tool', 'error');
        }
    } catch (error) {
        showAlert('Error issuing tool', 'error');
    }
}

function clearIssuanceForm() {
    document.getElementById('issuanceForm').reset();
    setCurrentDateTime();
    document.getElementById('toolDescription').value = '';
    document.getElementById('availableQuantity').textContent = '0';
}

function openReturnModal(issuanceId) {
    const issuance = myIssuances.find(i => i.id === issuanceId);
    if (!issuance) return;
    
    document.getElementById('returnIssuanceId').value = issuanceId;
    
    // Populate tool info
    const toolInfo = `
        <strong>Tool:</strong> ${issuance.tool_code} - ${issuance.tool_description}<br>
        <strong>Quantity:</strong> ${issuance.quantity}<br>
        <strong>Issued To:</strong> ${issuance.issued_to_name} (${issuance.issued_to_id})<br>
        <strong>Department:</strong> ${issuance.department}<br>
        <strong>Time Out:</strong> ${issuance.time_out}
    `;
    document.getElementById('returnToolInfo').innerHTML = toolInfo;
    
    // Set current time as default
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5);
    document.getElementById('timeIn').value = timeString;
    
    // Reset form fields
    document.getElementById('conditionReturned').value = '';
    document.getElementById('returnComments').value = '';
    
    document.getElementById('returnModal').style.display = 'block';
}

function handleConditionChange() {
    const condition = document.getElementById('conditionReturned').value;
    const timeInField = document.getElementById('timeIn');
    const submitBtn = document.getElementById('submitReturnText');
    
    if (condition === 'Lost/Missing') {
        timeInField.required = false;
        timeInField.value = '';
        timeInField.disabled = true;
        submitBtn.textContent = 'Mark as Lost';
        submitBtn.parentElement.className = 'btn btn-warning';
    } else {
        timeInField.required = true;
        timeInField.disabled = false;
        if (!timeInField.value) {
            const now = new Date();
            timeInField.value = now.toTimeString().slice(0, 5);
        }
        submitBtn.textContent = 'Mark as Returned';
        submitBtn.parentElement.className = 'btn btn-success';
    }
}

async function handleReturnTool(e) {
    e.preventDefault();
    
    const id = document.getElementById('returnIssuanceId').value;
    const timeIn = document.getElementById('timeIn').value;
    const conditionReturned = document.getElementById('conditionReturned').value;
    const comments = document.getElementById('returnComments').value;
    
    if (!conditionReturned) {
        showAlert('Please select a condition', 'error');
        return;
    }
    
    // For Lost/Missing, time_in is not required
    if (conditionReturned !== 'Lost/Missing' && !timeIn) {
        showAlert('Please enter the time in', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tool-issuances/${id}/return`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                time_in: timeIn || null,
                condition_returned: conditionReturned,
                status: conditionReturned === 'Lost/Missing' ? 'lost' : 'returned',
                comments: comments
            })
        });
        
        if (response.ok) {
            document.getElementById('returnModal').style.display = 'none';
            const statusText = conditionReturned === 'Lost/Missing' ? 'marked as lost' : 'marked as returned';
            showAlert(`Tool ${statusText} successfully!`, 'success');
            loadDashboardData(); // Refresh all data
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to return tool', 'error');
        }
    } catch (error) {
        console.error('Error returning tool:', error);
        showAlert('Error returning tool', 'error');
    }
}

function applyDateFilter() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    
    if (!startDate || !endDate) {
        displayMyRecords(myIssuances);
        return;
    }
    
    const filtered = myIssuances.filter(issuance => {
        const issueDate = issuance.date;
        return issueDate >= startDate && issueDate <= endDate;
    });
    
    displayMyRecords(filtered);
}

function handleToolSearch() {
    const searchTerm = document.getElementById('toolSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#availableToolsTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function exportAllRecords() {
    try {
        showAlert('Exporting all records...', 'success');
        
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
            a.download = `Rabotec_All_Records_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('All records exported successfully!', 'success');
        } else {
            const errorText = await response.text();
            console.error('Export failed:', errorText);
            showAlert('Failed to export records', 'error');
        }
    } catch (error) {
        console.error('Error exporting records:', error);
        showAlert('Error exporting records', 'error');
    }
}

async function exportMyRecords(format) {
    try {
        showAlert(`Exporting records as ${format.toUpperCase()}...`, 'success');
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        
        const params = new URLSearchParams({ format });
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        if (format === 'pdf') {
            const response = await fetch(`/api/export/issuances?${params}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Rabotec_My_Records_${new Date().toISOString().slice(0,10)}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showAlert('Records exported successfully!', 'success');
            } else {
                const errorText = await response.text();
                console.error('Export failed:', errorText);
                showAlert('Failed to export records', 'error');
            }
        } else {
            window.open(`/api/export/issuances?${params}`, '_blank');
        }
    } catch (error) {
        console.error('Error exporting records:', error);
        showAlert('Error exporting records', 'error');
    }
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
        default: return 'badge-info';
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function showAlert(message, type) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.style.minWidth = '300px';
    
    document.body.appendChild(alert);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 3000);
}
