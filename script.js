// Backend API URL
const API_URL = 'http://localhost:3001'; 


function parseDateString(dateStr) {
    if (!dateStr) return null;

    // Try ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
    }

    // Try US (MM/DD/YYYY)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [mm, dd, yyyy] = dateStr.split('/');
        return new Date(`${yyyy}-${mm}-${dd}`);
    }

    // Fallback
    return new Date(dateStr);
}

function convertToISO(dateStr) {
    const date = parseDateString(dateStr); // Parses MM/DD/YYYY or YYYY-MM-DD
    if (!date || isNaN(date)) return '';
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

function formatDateUS(dateStr) {
    const date = parseDateString(dateStr);
    if (!date || isNaN(date)) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}


// --- Logout Functionality ---
const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    currentUser = { token: null, username: null, role: null, fullName: null };
    window.location.href = 'login.html';
};

// User session variables from localStorage
let currentUser = {
    token: localStorage.getItem('token') || null,
    username: localStorage.getItem('username') || null,
    role: localStorage.getItem('role') || null,
    fullName: localStorage.getItem('fullName') || null,
};

let reports = [];
let filteredReports = [];
let editId = null;

// Store a map of username to fullName for display purposes
let employeeMap = new Map(); // username -> fullName

// --- Common DOM Elements ---
const logoutBtn = document.getElementById('logout-btn');
const userInfoSpan = document.getElementById('user-info');
const currentPage = window.location.pathname.split('/').pop();

// --- Elements specific to index.html (Reports Page) ---
let addReportForm, reportBody, reportFooter, exportBtn, filterBtn, cancelBtn,
    deleteSelectedBtn, selectAllCheckbox, employeeSelectForm, clientSelectForm,
    clientFilterSelect, employeeFilterSelect, projectFilterSelect, adminPageBtn;

if (currentPage === 'index.html') {
    addReportForm = document.getElementById('add-report-form');
    reportBody = document.getElementById('report-body');
    reportFooter = document.getElementById('report-footer');
    exportBtn = document.getElementById('export-btn');
    filterBtn = document.getElementById('filter-btn');
    cancelBtn = document.getElementById('cancel-edit');
    deleteSelectedBtn = document.getElementById('delete-selected-btn');
    selectAllCheckbox = document.getElementById('select-all-checkbox');
    employeeSelectForm = document.getElementById('employee-name');
    clientSelectForm = document.getElementById('client-name');
    clientFilterSelect = document.getElementById('client-filter');
    employeeFilterSelect = document.getElementById('employee-filter');
    projectFilterSelect = document.getElementById('project-filter');

    adminPageBtn = document.getElementById('admin-page-btn');
    if (currentUser.role === 'admin') {
        adminPageBtn.style.display = 'inline-block';
        adminPageBtn.addEventListener('click', () => window.location.href = 'admin.html');
    } else {
        adminPageBtn.style.display = 'none';
    }
}

// --- Elements specific to admin.html (Admin Panel) ---
let newAuthUsernameInput, newAuthPasswordInput, newAuthFullNameInput, newAuthRoleSelect,
    createAuthAccountBtn, authAccountMessage, authAccountError, authUserList,
    newClientInput, newClientSlugInput, addClientBtn, clientList, reportsPageBtn,
    clientMessage, clientError; // Added clientMessage and clientError

if (currentPage === 'admin.html') {
    newAuthUsernameInput = document.getElementById('new-auth-username');
    newAuthPasswordInput = document.getElementById('new-auth-password');
    newAuthFullNameInput = document.getElementById('new-auth-fullname');
    newAuthRoleSelect = document.getElementById('new-auth-role');
    createAuthAccountBtn = document.getElementById('create-auth-account-btn');
    authAccountMessage = document.getElementById('auth-account-message');
    authAccountError = document.getElementById('auth-account-error');
    authUserList = document.getElementById('auth-user-list');

    newClientInput = document.getElementById('new-client-name');
    newClientSlugInput = document.getElementById('new-client-slug'); // Get the new slug input
    addClientBtn = document.getElementById('add-client-btn');
    clientList = document.getElementById('client-list');
    clientMessage = document.getElementById('client-message'); // Get client message div
    clientError = document.getElementById('client-error');   // Get client error div

    reportsPageBtn = document.getElementById('reports-page-btn');
    reportsPageBtn.addEventListener('click', () => window.location.href = 'index.html');

}

// --- Helper Function: Get Headers with Authorization Token ---
const getAuthHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
    };
};

// --- API Calls ---

const registerAuthUser = async (username, password, fullName, role) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ username, password, fullName, role })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to register account.');
    }
    return response.json();
};

const fetchAuthUsers = async () => {
    const response = await fetch(`${API_URL}/api/auth/users`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch login accounts: ' + response.statusText);
    return response.json();
};

const updateAuthUser = async (id, data) => {
    const response = await fetch(`${API_URL}/api/auth/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update login account: ' + response.statusText);
    }
    return response.json();
};

const deleteAuthUser = async (id) => {
    const response = await fetch(`${API_URL}/api/auth/users/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete login account: ' + response.statusText);
    }
    return response.json();
};

const fetchEmployeesForDropdown = async () => {
    const response = await fetch(`${API_URL}/api/auth/employees`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch employees: ' + response.statusText);
    return response.json();
};


const fetchClients = async () => {
    const response = await fetch(`${API_URL}/clients`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch clients: ' + response.statusText);
    return response.json();
};
const saveClient = async (name, slug) => { // Added slug parameter
    const response = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, slug }) // Send name and slug
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add client: ' + response.statusText);
    }
    return response.json();
};
const updateClient = async (id, name, slug) => { // Added slug parameter
    const response = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, slug }) // Send name and slug
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update client: ' + response.statusText);
    }
    return response.json();
};
const deleteClient = async (id) => {
    const response = await fetch(`${API_URL}/clients/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete client: ' + response.statusText);
    }
    return response.json();
};

let clientNameToSlugMap = new Map(); // name -> slug


const fetchReports = async () => {
    const response = await fetch(`${API_URL}/reports`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch reports: ' + response.statusText);
    return response.json();
};
const saveReport = async (report) => {
    const method = report._id ? 'PUT' : 'POST';
    const url = report._id ? `${API_URL}/reports/${report._id}` : `${API_URL}/reports`;
    console.log('url' +url)
    console.log(report)
    console.log(getAuthHeaders())
    const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(report)
    });
    console.log(response);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save report: ' + response.statusText);
    }
    return response.json();
};
const deleteReport = async (id) => {
    const response = await fetch(`${API_URL}/reports/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete report: ' + response.statusText);
    }
    return response.json();
};
const deleteSelectedReports = async (ids) => {
    const response = await fetch(`${API_URL}/reports/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to bulk delete reports: ' + response.statusText);
    }
    return response.json();
};

const fetchProjectsByClient = async (clientName) => {
    const response = await fetch(`${API_URL}/reports/projects-by-client?clientName=${encodeURIComponent(clientName)}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch projects by client: ' + response.statusText);
    return response.json();
};

const fetchEmployeesByProject = async (clientName, projectName) => {
    let url = `${API_URL}/reports/employees-by-project?projectName=${encodeURIComponent(projectName)}`;
    if (clientName) {
        url += `&clientName=${encodeURIComponent(clientName)}`;
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch employees by project: ' + response.statusText);
    return response.json();
};


// --- Render Functions ---

const renderAdminPanelContent = async () => {
    if (currentUser.role !== 'admin') {
        if (currentPage === 'admin.html') {
            alert("You are not authorized to access the admin panel.");
            window.location.href = 'index.html';
        }
        return;
    }

    if (currentPage === 'admin.html') {
        // ... (AuthUser rendering)


        try { // Added try-catch for better error handling during fetch
            const authUsers = await fetchAuthUsers();
            authUserList.innerHTML = ''; // Clear list before populating
            authUsers.forEach(au => {
                const li = document.createElement('li');
                li.setAttribute('data-id', au._id);
                li.innerHTML = `
                    <span>${au.username} (${au.fullName || 'N/A'}) - ${au.role}</span>
                    <div class="action-buttons">
                        <button class="edit-btn edit-auth-user-btn" data-username="${au.username}" data-fullname="${au.fullName || ''}" data-role="${au.role}"><i class="fas fa-edit"></i></button>
                        ${au.username === currentUser.username ? '' : `<button class="delete-btn delete-auth-user-btn"><i class="fas fa-trash-alt"></i></button>`}
                    </div>
                `;
                authUserList.appendChild(li);
            });
        } catch (error) {
            console.error('Error rendering auth users:', error);
            // Optionally display an error message on the page
            if (authAccountError) {
                authAccountError.textContent = `Failed to load users: ${error.message}.`;
                authAccountError.style.display = 'block';
            }
        }


        const clients = await fetchClients();
        clientList.innerHTML = '';
        clientNameToSlugMap.clear(); // Clear map before repopulating
        clients.forEach(c => {
            clientNameToSlugMap.set(c.name, c.slug); // Populate map
            const li = document.createElement('li');
            li.setAttribute('data-id', c._id);
            li.innerHTML = `
                <span>${c.name} (Slug: ${c.slug})</span>
                <div class="action-buttons">
                    <button class="edit-btn edit-client-btn" data-name="${c.name}" data-slug="${c.slug}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn delete-client-btn"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            clientList.appendChild(li);
        });
    }
};

// Modified populateDropdown: Can handle arrays of strings or objects with valueKey/textKey
const populateDropdown = (selectElement, options, initialText, valueKey = null, textKey = null) => {
    selectElement.innerHTML = `<option value="" disabled selected>${initialText}</option>`;
    if (initialText.includes('All')) { // For filter dropdowns, add an "All" option
         selectElement.innerHTML = `<option value="">${initialText}</option>`;
    } else {
         selectElement.innerHTML = `<option value="" disabled selected>${initialText}</option>`;
    }

    options.forEach(option => {
        let value, text;
        if (valueKey && textKey) {
            value = option[valueKey];
            text = option[textKey];
        } else { // For simple arrays of strings (like projects)
            value = option;
            text = option;
        }
        selectElement.innerHTML += `<option value="${value}">${text}</option>`;
    });
};


const renderDropdowns = async () => {
    // Client dropdown for report form and filter (always fully populated)
    const clients = await fetchClients();
    clientNameToSlugMap.clear(); // Clear before populating
    clients.forEach(c => clientNameToSlugMap.set(c.name, c.slug)); // Populate map

    if (clientSelectForm) {
        populateDropdown(clientSelectForm, clients, 'CLIENT', 'slug', 'name'); // Display name, value name
    }
    if (clientFilterSelect) {
        populateDropdown(clientFilterSelect, clients, 'All Clients', 'slug', 'name'); // Display name, value name
    }

    // Initialize Project & Employee filters as empty/disabled
    if (projectFilterSelect) {
        populateDropdown(projectFilterSelect, [], 'All Projects', 'name', 'name'); // Ensure correct initial call
        projectFilterSelect.disabled = true;
    }
    if (employeeFilterSelect) {
        const employees = await fetchEmployeesForDropdown();
        populateDropdown(employeeFilterSelect, employees, 'All Employees', 'username', 'fullName'); // Value is username, text is fullName
        // employeeFilterSelect.disabled = true;
    }

    // Initial Employee dropdown for report form (all employees)
    const employees = await fetchEmployeesForDropdown();
    // Populate employeeMap for quick lookups
    employeeMap.clear();
    employees.forEach(emp => employeeMap.set(emp.username, emp.fullName));

    if (employeeSelectForm) {
        // Here, value is username, text is fullName
        populateDropdown(employeeSelectForm, employees, 'EMPLOYEE', 'username', 'fullName');
    }

    // For employees, pre-fill and disable their name in the report form
    if (currentUser.role === 'employee' && employeeSelectForm) {
        employeeSelectForm.value = currentUser.username; // Set value to username
        employeeSelectForm.disabled = true;
    } else if (employeeSelectForm) {
        employeeSelectForm.disabled = false;
    }

    // Hide employee filter for employee role on reports page
    if (employeeFilterSelect && currentUser.role === 'employee') {
        employeeFilterSelect.style.display = 'none';
    } else if (employeeFilterSelect) {
        employeeFilterSelect.style.display = 'inline-block';
    }
};


const renderReports = () => {
    if (!reportBody) return;

    reportBody.innerHTML = '';
    reportFooter.innerHTML = '';
    let totalHours = 0;

    userInfoSpan.textContent = `Logged in as: ${currentUser.username} (${currentUser.role}) [${currentUser.fullName}]`;

    if (currentUser.role !== 'admin') {
        selectAllCheckbox.style.display = 'none';
        deleteSelectedBtn.style.display = 'none';
    } else {
        selectAllCheckbox.style.display = 'inline-block';
    }

    filteredReports.forEach(report => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', report._id);

        totalHours += parseFloat(report.hours || 0);

        const isEditable = currentUser.role === 'admin' || (currentUser.role === 'employee' && report.employeeUsername === currentUser.username);

        const actionButtonsHtml = isEditable ? `
            <div class="action-buttons">
                <button class="edit-btn"><i class="fas fa-edit"></i></button>
                <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        ` : `<span style="color:#888; font-size:0.8em;">No actions</span>`;

        row.innerHTML = `
            <td><input type="checkbox" class="report-checkbox" data-id="${report._id}" ${currentUser.role !== 'admin' ? 'style="display:none;"' : ''}></td>
            <td class="date-cell">${formatDateUS(report.date)}</td>
            <td>${report.employeeName}</td> <td>${report.displayClientName}</td>
            <td>${report.projectName}</td>
            <td>${report.taskDescription}</td>
            <td>${report.hours}</td>
            <td>${report.notes || ''}</td>
            <td>${actionButtonsHtml}</td>
        `;
        reportBody.appendChild(row);
    });

    reportFooter.innerHTML = `
        <tr>
            <td></td>
            <td colspan="6" style="text-align:right;font-weight:bold;">Total Hours:</td>
            <td style="font-weight:bold;">${totalHours.toFixed(2)}</td>
            <td colspan="2"></td>
        </tr>
    `;
    selectAllCheckbox.checked = false;
    toggleDeleteSelectedButton();
};

// --- Filter Logic ---
const applyFilters = () => {
    // if (!clientFilterSelect) return;
const clientfilter = document.getElementById('client-filter').value;
    
    const clientFilterName = clientFilterSelect.value; // This is the client's display name
    // console.log('clientFilterSelect', +clientFilterSelect)
    const clientFilterSlug = clientNameToSlugMap.get(clientFilterName) || ''; // Get slug from map
    const projectFilter = projectFilterSelect.value;
    const employeeFilterUsername = employeeFilterSelect.value;
    const startDate = document.getElementById('start-date-filter').value;
    const endDate = document.getElementById('end-date-filter').value;

    console.log('clientFilterName' + clientFilterName)
     console.log('projectFilter' + projectFilter)
      console.log('employeeFilterUsername' + employeeFilterUsername)
    filteredReports = reports.filter(r => {
        const reportDate = parseDateString(r.date);
        const start = startDate ? parseDateString(startDate) : null;
        const end = endDate ? parseDateString(endDate) : null;
        console.log(r)
        console.log('reportDate', reportDate)
        console.log('start', start)
        console.log('endDate', end)

        
        return (
           
            // Compare report's clientName (which is a slug) with the filtered client slug
            (!clientFilterName || r.clientName === clientFilterName) &&
            (!projectFilter || r.projectName === projectFilter) &&
            (currentUser.role === 'admin' ? (!employeeFilterUsername || r.employeeUsername === employeeFilterUsername) : true) &&
            (!start || reportDate >= start) &&
            (!end || reportDate <= end)
        );
    });
    renderReports();
};

// --- Report Form Management (index.html only) ---
const startEditReport = (id) => {
    const report = reports.find(r => r._id === id);
    if (report) {
        document.getElementById('date').value = convertToISO(report.date);
        employeeSelectForm.value = report.employeeUsername;

        /*
        let clientDisplayNameForReport = '';
        for (let [name, slug] of clientNameToSlugMap.entries()) {
            if (slug === report.clientName) {
                clientDisplayNameForReport = name;
                break;
            }
        }
        clientSelectForm.value = clientDisplayNameForReport; // Set to display name
        */

        if (currentUser.role === 'employee') {
            employeeSelectForm.disabled = true;
        }
        document.getElementById('client-name').value = report.clientName;
        document.getElementById('project-name').value = report.projectName;
        document.getElementById('task-description').value = report.taskDescription;
        document.getElementById('hours').value = report.hours;
        document.getElementById('notes').value = report.notes;
        editId = report._id;
        addReportForm.querySelector('button[type="submit"]').textContent = 'Update Report';
        cancelBtn.style.display = 'block';
    }
};

const resetForm = () => {
    if (!addReportForm) return;
    addReportForm.reset();
    editId = null;
    addReportForm.querySelector('button[type="submit"]').textContent = 'Add Report';
    cancelBtn.style.display = 'none';
    if (currentUser.role === 'employee') {
        employeeSelectForm.value = currentUser.username; // Set to current user's username
        employeeSelectForm.disabled = true;
    } else {
        employeeSelectForm.disabled = false;
    }
};

// --- Conditional "Delete Selected" Button Visibility ---
const toggleDeleteSelectedButton = () => {
    if (!deleteSelectedBtn || currentUser.role !== 'admin') return;
    const checkedCount = document.querySelectorAll('.report-checkbox:checked').length;
    deleteSelectedBtn.style.display = checkedCount > 0 ? 'inline-block' : 'none';
};


// --- Event Listeners ---

if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
}


if (currentPage === 'index.html') {
    // Add/Update Report Form Submission
    addReportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedEmployeeUsername = employeeSelectForm.value;
        const selectedEmployeeFullName = employeeMap.get(selectedEmployeeUsername); // Get fullName from map

        const report = {
            date: document.getElementById('date').value,
            employeeName: selectedEmployeeFullName, // Save the fullName corresponding to the selected username
            employeeUsername: selectedEmployeeUsername, // Save the stable username
            clientName: clientSelectForm.value,
            projectName: document.getElementById('project-name').value,
            taskDescription: document.getElementById('task-description').value,
            hours: document.getElementById('hours').value,
            notes: document.getElementById('notes').value,
        };
        console.log(report)

        // For employees, these will be overridden by the backend for security
        // But for clarity in frontend logic, we still set them here.
        if (currentUser.role === 'employee') {
            report.employeeName = currentUser.fullName;
            report.employeeUsername = currentUser.username;
        }

        if (editId) report._id = editId;

        try {
            await saveReport(report);
            await loadAllData();
            resetForm();
        } catch (error) {
            console.error('Error saving report:', error);
            alert(`Failed to save report: ${error.message}. Please check permissions or connection.`);
        }
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.report-checkbox:checked')).map(cb => cb.getAttribute('data-id'));
        if (!selectedIds.length) {
            return alert('Please select reports to delete.');
        }

        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected reports?`)) {
            try {
                await deleteSelectedReports(selectedIds);
                await loadAllData();
            } catch (error) {
                console.error('Error deleting selected reports:', error);
                alert(`Failed to delete selected reports: ${error.message}. Please check permissions.`);
            }
        }
    });

    selectAllCheckbox.addEventListener('change', () => {
        document.querySelectorAll('.report-checkbox').forEach(cb => cb.checked = selectAllCheckbox.checked);
        toggleDeleteSelectedButton();
    });

    reportBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('report-checkbox')) {
            toggleDeleteSelectedButton();
        }
    });

    reportBody.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');

        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        const reportBeingEdited = reports.find(r => r._id === id);
        // Action allowed if admin or if employee and report's employeeUsername matches current user's username
        const isActionAllowed = currentUser.role === 'admin' || (currentUser.role === 'employee' && reportBeingEdited.employeeUsername === currentUser.username);

        if (!isActionAllowed) return;

        if (editBtn) {
            startEditReport(id);
        } else if (deleteBtn) {
            if (confirm('Are you sure you want to delete this report?')) {
                try {
                    await deleteReport(id);
                    await loadAllData();
                } catch (error) {
                    console.error('Error deleting report:', error);
                    alert(`Failed to delete report: ${error.message}. Please check permissions.`);
                }
            }
        }
    });

    cancelBtn.addEventListener('click', resetForm);

    filterBtn.addEventListener('click', applyFilters);

    // --- Dependent Filter Dropdown Logic ---
    clientFilterSelect.addEventListener('change', async () => {
        const selectedClientName = clientFilterSelect.value; // This is the client's display name
        // The backend `fetchProjectsByClient` expects the display name, which it then converts to slug
        // so no change needed here.
        populateDropdown(projectFilterSelect, [], 'All Projects', '', '');
        const employees = await fetchEmployeesForDropdown();
        populateDropdown(employeeFilterSelect, employees, 'All Employees', 'username', 'fullName');
        projectFilterSelect.disabled = true;

        if (selectedClientName) {
            try {
                const projects = await fetchProjectsByClient(selectedClientName);
                populateDropdown(projectFilterSelect, projects, 'All Projects', '', '');
                projectFilterSelect.disabled = false;
            } catch (error) {
                console.error('Error loading projects for client:', error);
            }
        }
        applyFilters();
    });

    projectFilterSelect.addEventListener('change', async () => {
        const selectedClientName = clientFilterSelect.value; // Display name
        const selectedProject = projectFilterSelect.value;
        const employees = await fetchEmployeesForDropdown();
        populateDropdown(employeeFilterSelect, employees, 'All Employees', 'username', 'fullName');
        // employeeFilterSelect.disabled = true;

        if (currentUser.role === 'admin' && selectedProject) {
            try {
                // const employees = await fetchEmployeesByProject(selectedClientName, selectedProject); // Pass client name
                
                populateDropdown(employeeFilterSelect, employees, 'All Employees', 'username', 'fullName');
                employeeFilterSelect.disabled = false;
            } catch (error) {
                console.error('Error loading employees for project:', error);
            }
        }
        applyFilters();
    });

    employeeFilterSelect.addEventListener('change', applyFilters);

    document.getElementById('start-date-filter').addEventListener('change', applyFilters);
    document.getElementById('end-date-filter').addEventListener('change', applyFilters);

    exportBtn.addEventListener('click', () => {
       

        // Sort and group reports by project
        // const sortedReports = [...filteredReports].sort((a, b) => a.projectName.localeCompare(b.projectName));
        // Sort by projectName first, then by date (ascending)
        const sortedReports = [...filteredReports].sort((a, b) => {
            const projectCompare = a.projectName.localeCompare(b.projectName);
            if (projectCompare !== 0) return projectCompare;

            // Convert dd-mm-yyyy to Date object safely
            const parseDate = (str) => {
                const [dd, mm, yyyy] = str.split('-');
                return new Date(`${yyyy}-${mm}-${dd}`); // Safe format for Date constructor
            };

            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            return dateA - dateB;
        });


        let dataToExport = [];
        let currentProject = null;
        let projectTotal = 0;
        let grandTotal = 0;
        let projectStartIndex = 2; // Excel rows are 1-indexed, header is row 1
        const projectRows = [];

        sortedReports.forEach((report, idx) => {
            if (currentProject !== report.projectName) {
                if (currentProject !== null) {
                    // Push project total row
                    dataToExport.push({
                        'Date': '',
                        'Project': '',
                        'Task Description': 'Total Hours',
                        'Hours': projectTotal.toFixed(2),
                        'Notes': ''
                    });
                    projectRows.push({ row: dataToExport.length + 1, type: 'projectTotal' });
                    // Add blank row after project total
                    dataToExport.push({
                        'Date': '',
                        'Project': '',
                        'Task Description': '',
                        'Hours': '',
                        'Notes': ''
                    });
                }
                currentProject = report.projectName;
                projectTotal = 0;
                projectStartIndex = dataToExport.length + 2;
            }
            const hoursWorked = parseFloat(report.hours || 0);
            projectTotal += hoursWorked;
            grandTotal += hoursWorked;
            dataToExport.push({
                'Date': report.date,
                'Project': report.projectName,
                'Task Description': report.taskDescription,
                'Hours': hoursWorked.toFixed(2),
                'Notes': report.notes
            });
        });
        // Last project total
        if (currentProject !== null) {
            dataToExport.push({
                'Date': '',
                'Project': '',
                'Task Description': 'Total Hours',
                'Hours': projectTotal.toFixed(2),
                'Notes': ''
            });
            projectRows.push({ row: dataToExport.length + 1, type: 'projectTotal' });
            // Add blank row after last project total
            dataToExport.push({
                'Date': '',
                'Project': '',
                'Task Description': '',
                'Hours': '',
                'Notes': ''
            });
        }
        // Grand total
        dataToExport.push({
            'Date': '',
            'Project': '',
            'Task Description': 'Grand Total Hours',
            'Hours': grandTotal.toFixed(2),
            'Notes': ''
        });
        const grandTotalRow = dataToExport.length + 1;

        const ws = XLSX.utils.json_to_sheet(dataToExport);

        // Add styles for headers
        const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "C6EFCE" } } }; // Light Green
        const headers = ['A1', 'B1', 'C1', 'D1', 'E1'];
        headers.forEach(cell => {
            if (ws[cell]) ws[cell].s = headerStyle;
        });

        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, // Date
            { wch: 25 }, // Project
            { wch: 60 }, // Task Description
            { wch: 12 }, // Hours
            { wch: 40 }  // Notes
        ];

        // Set row height to 15pt (â‰ˆ20px) for all rows
        ws['!rows'] = Array(dataToExport.length + 1).fill({ hpt: 15 });

        // Vertically middle-align all cells
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
                if (ws[cell_address]) {
                    ws[cell_address].s = ws[cell_address].s || {};
                    ws[cell_address].s.alignment = { ...ws[cell_address].s.alignment, vertical: 'center' };
                }
            }
        }

        // Style for project total and grand total rows
        const totalStyle = { font: { bold: true }, fill: { fgColor: { rgb: "F0F0F0" } } }; // Light Grey
        const grandTotalStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFF2CC" } } }; // Light Yellow

        // Apply style to each project total row
        projectRows.forEach(({ row }) => {
            const labelCell = `C${row}`;
            const valueCell = `D${row}`;
            if (ws[labelCell]) ws[labelCell].s = totalStyle;
            if (ws[valueCell]) ws[valueCell].s = totalStyle;
        });
        // Apply style to grand total row
        const grandLabelCell = `C${grandTotalRow}`;
        const grandValueCell = `D${grandTotalRow}`;
        if (ws[grandLabelCell]) ws[grandLabelCell].s = grandTotalStyle;
        if (ws[grandValueCell]) ws[grandValueCell].s = grandTotalStyle;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reports');
        XLSX.writeFile(wb, 'Workbook_Reports.xlsx');


        const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filename = `workbook-reports-${currentDate}.xlsx`; // Dynamic filename
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename; // Use dynamic filename here
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);



    });






const projectInput = document.getElementById('project-name');
const projectSuggestionList = document.getElementById('project-suggestions');

let debounceTimeout;
projectInput.addEventListener('input', () => {
    const clientSlug = clientSelectForm.value; // value is slug
    const query = projectInput.value.trim();

    if (!clientSlug || query.length < 1) return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        try {
            const projects = await fetchProjectsByClient(clientSlug);
            const filtered = projects.filter(p => p.toLowerCase().includes(query.toLowerCase()));

            projectSuggestionList.innerHTML = '';
            filtered.forEach(p => {
                const option = document.createElement('option');
                option.value = p;
                projectSuggestionList.appendChild(option);
            });
        } catch (error) {
            console.error('Autocomplete project fetch failed:', error);
        }
    }, 300); // debounce 300ms
});






} else if (currentPage === 'admin.html') {
    
    let currentAuthUserEditId = null;
    let currentClientEditId = null;

    // Event listener for Client Slug input to auto-generate
    newClientInput.addEventListener('input', () => {
        if (!currentClientEditId && newClientSlugInput && newClientInput) { // Only auto-generate if not editing
            const name = newClientInput.value.trim();
            const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
            newClientSlugInput.value = generatedSlug;
        }
    });

    // Create/Update Auth User account
    createAuthAccountBtn.addEventListener('click', async () => {
        authAccountMessage.style.display = 'none';
        authAccountError.style.display = 'none';

        const username = newAuthUsernameInput.value.trim();
        const password = newAuthPasswordInput.value.trim();
        const fullName = newAuthFullNameInput.value.trim();
        const role = newAuthRoleSelect.value;

        if (!username || !fullName) {
            authAccountError.textContent = 'Username and Full Name are required.';
            authAccountError.style.display = 'block';
            return;
        }

        if (!currentAuthUserEditId && password.length < 6) { // Password required only for new accounts
            authAccountError.textContent = 'Password must be at least 6 characters long for new accounts.';
            authAccountError.style.display = 'block';
            return;
        }

        try {
            let data;
            if (currentAuthUserEditId) {
                const updateData = { fullName, role }; // Only update fullName and role
                if (password) updateData.password = password; // Only update password if provided
                // username is intentionally NOT in updateData here, as it's disabled.
                data = await updateAuthUser(currentAuthUserEditId, updateData);
                authAccountMessage.textContent = `Account for ${data.username} (${data.fullName}) updated successfully!`;
            } else {
                // For new creation, username is sent.
                data = await registerAuthUser(username, password, fullName, role);
                authAccountMessage.textContent = `Account for ${data.username} (${data.fullName}) created successfully!`;
            }
            authAccountMessage.style.display = 'block';
            newAuthUsernameInput.value = '';
            newAuthPasswordInput.value = '';
            newAuthFullNameInput.value = '';
            newAuthRoleSelect.value = 'employee';
            createAuthAccountBtn.textContent = 'Create Account';
            currentAuthUserEditId = null;
            newAuthUsernameInput.disabled = false; // Re-enable for next new account entry
            await renderAdminPanelContent();
        } catch (error) {
            console.error('Error managing AuthUser account:', error);
            authAccountError.textContent = error.message;
            authAccountError.style.display = 'block';
        }
    });


    // Add/Update Client
    addClientBtn.addEventListener('click', async () => {
        clientMessage.style.display = 'none';
        clientError.style.display = 'none';

        const name = newClientInput.value.trim();
        const slug = newClientSlugInput.value.trim(); // Get slug from input

        if (!name) {
            clientError.textContent = 'Please enter a client name.';
            clientError.style.display = 'block';
            return;
        }
        if (!slug) { // Ensure slug is not empty
            clientError.textContent = 'Client slug cannot be empty.';
            clientError.style.display = 'block';
            return;
        }

        try {
            if (currentClientEditId) {
                await updateClient(currentClientEditId, name, slug); // Pass slug
                clientMessage.textContent = 'Client updated successfully!';
            } else {
                await saveClient(name, slug); // Pass slug
                clientMessage.textContent = 'Client added successfully!';
            }
            clientMessage.style.display = 'block';
            newClientInput.value = '';
            newClientSlugInput.value = ''; // Clear slug input
            addClientBtn.textContent = 'Add Client';
            currentClientEditId = null;
            await renderAdminPanelContent();
        } catch (error) {
            console.error('Error managing client:', error);
            clientError.textContent = error.message;
            clientError.style.display = 'block';
        }
    });

    document.body.addEventListener('click', async (e) => {
        if (e.target.closest('.edit-auth-user-btn')) {
            const btn = e.target.closest('.edit-auth-user-btn');
            const listItem = btn.closest('li');
            currentAuthUserEditId = listItem.getAttribute('data-id');

            newAuthUsernameInput.value = btn.getAttribute('data-username');
            newAuthUsernameInput.disabled = true; // <--- ADD THIS LINE
            newAuthFullNameInput.value = btn.getAttribute('data-fullname');
            newAuthRoleSelect.value = btn.getAttribute('data-role');
            newAuthPasswordInput.value = '';
            createAuthAccountBtn.textContent = 'Update Account';
        } else if (e.target.closest('.delete-auth-user-btn')) {
            const id = e.target.closest('li').getAttribute('data-id');
            if (confirm('Are you sure you want to delete this login account? This will also affect reports associated with this employee. This action cannot be undone.')) {
                try {
                    await deleteAuthUser(id);
                    alert('Login account deleted successfully!');
                    await renderAdminPanelContent();
                } catch (error) {
                    console.error('Error deleting AuthUser:', error);
                    alert(`Failed to delete login account: ${error.message}.`);
                }
            }
        } else if (e.target.closest('.edit-client-btn')) {
            const btn = e.target.closest('.edit-client-btn');
            const listItem = btn.closest('li');
            currentClientEditId = listItem.getAttribute('data-id');
            newClientInput.value = btn.getAttribute('data-name');
            newClientSlugInput.value = btn.getAttribute('data-slug'); // Set slug input
            addClientBtn.textContent = 'Update Client';
        } else if (e.target.closest('.delete-client-btn')) {
            const id = e.target.closest('li').getAttribute('data-id');
            if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
                try {
                    await deleteClient(id);
                    clientMessage.textContent = 'Client deleted successfully!';
                    clientMessage.style.display = 'block';
                    await renderAdminPanelContent();
                } catch (error) {
                    console.error('Error deleting client:', error);
                    clientError.textContent = error.message;
                    clientError.style.display = 'block';
                }
            }
        }
    });

}


// --- Initial Data Load & Session Check ---
const loadAllData = async () => {
    if (!currentUser.token) {
        window.location.href = 'login.html';
        return;
    }

    if (currentPage === 'admin.html' && currentUser.role !== 'admin') {
        alert("You are not authorized to access the admin panel.");
        window.location.href = 'index.html';
        return;
    }

    try {
        if (currentPage === 'index.html') {
            reports = await fetchReports();
            filteredReports = [...reports];
            await renderDropdowns(); // This needs to populate employeeMap first
            renderReports();
            applyFilters();
            resetForm();
        } else if (currentPage === 'admin.html') {
            await renderAdminPanelContent();
        }
    } catch (error) {
        console.error('Error loading initial data:', error);
        if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Failed to fetch')) {
            alert('Your session has expired or you are not authorized. Please log in again.');
            logoutUser();
        } else {
            alert(`Failed to load data: ${error.message}. The backend server might not be running or accessible.`);
        }
    }
};

window.addEventListener('DOMContentLoaded', loadAllData);

// Helper to format date as DD-MM-YYYY
    function formatDateDMY(dateStr) {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
    }