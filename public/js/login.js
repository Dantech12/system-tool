// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const alertContainer = document.getElementById('alert-container');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Show loading state
        loginText.classList.add('d-none');
        loginSpinner.classList.remove('d-none');
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1000);
            } else {
                showAlert(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            showAlert('Connection error. Please try again.', 'error');
        } finally {
            // Hide loading state
            loginText.classList.remove('d-none');
            loginSpinner.classList.add('d-none');
        }
    });

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
    
    // Initialize modal event listeners
    document.getElementById('alertModalOk').addEventListener('click', () => {
        document.getElementById('alertModal').style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        const alertModal = document.getElementById('alertModal');
        if (event.target === alertModal) {
            alertModal.style.display = 'none';
        }
    });
});
