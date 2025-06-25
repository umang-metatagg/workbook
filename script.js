document.addEventListener('DOMContentLoaded', () => {
    const addReportForm = document.getElementById('add-report-form');
    const reportBody = document.getElementById('report-body');
    const reportFooter = document.getElementById('report-footer');
    const exportBtn = document.getElementById('export-btn');
    const filterBtn = document.getElementById('filter-btn');
    const cancelBtn = document.getElementById('cancel-edit');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');

    let reports = [];
    let filteredReports = [];
    let editId = null;

    // Backend API URL
    const API_URL =
        window.location.hostname === 'http://localhost:3001/reports';

    // Fetch reports from backend
    const fetchReports = async () => {
        const res = await fetch(API_URL);
        return await res.json();
    };

    // Save reports to backend
    const saveReports = async (reports) => {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reports)
        });
    };

    // Load reports and initialize
    const initialize = async () => {
        reports = await fetchReports();
        filteredReports = [...reports];
        populateFilterDropdowns();
        applyFilters();
    };

    // Helper to format date as DD-MM-YY
    function formatDateDMY(dateStr) {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year.slice(2)}`;
    }

    const renderReports = () => {
        reportBody.innerHTML = '';
        reportFooter.innerHTML = '';
        let totalHours = 0;

        filteredReports.forEach(report => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', report.id);

            const hoursWorked = parseFloat(report.hours || 0).toFixed(2);
            totalHours += parseFloat(hoursWorked);

            row.innerHTML = `
                <td>
                    <input type="checkbox" class="report-checkbox" data-id="${report.id}">
                </td>
                <td>${formatDateDMY(report.date)}</td>
                <td>${report.employeeName}</td>
                <td>${report.clientName}</td>
                <td>${report.projectName}</td>
                <td>${report.taskDescription}</td>
                <td>${hoursWorked}</td>
                <td>${report.notes}</td>
                <td>
                    <button class="edit-btn"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            reportBody.appendChild(row);
        });

        const footerRow = document.createElement('tr');
        footerRow.innerHTML = `
            <td></td>
            <td colspan="7" style="text-align:right; font-weight:bold;">Total Hours:</td>
            <td style="font-weight:bold;">${totalHours.toFixed(2)}</td>
            <td colspan="2"></td>
        `;
        reportFooter.appendChild(footerRow);

        // Reset select all checkbox
        selectAllCheckbox.checked = false;
    };

    // Handle select all checkbox
    selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('.report-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
    });

    // Handle bulk delete
    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.report-checkbox:checked'))
            .map(checkbox => Number(checkbox.getAttribute('data-id')));

        if (selectedIds.length === 0) {
            alert('Please select reports to delete');
            return;
        }

        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected reports?`)) {
            reports = reports.filter(report => !selectedIds.includes(report.id));
            await saveReports(reports);
            populateFilterDropdowns();
            applyFilters();
        }
    });

    const applyFilters = () => {
        const clientFilter = document.getElementById('client-filter').value.toLowerCase();
        const projectFilter = document.getElementById('project-filter').value.toLowerCase();
        const employeeFilter = document.getElementById('employee-filter').value.toLowerCase();
        const startDateFilter = document.getElementById('start-date-filter').value;
        const endDateFilter = document.getElementById('end-date-filter').value;

        filteredReports = reports.filter(report => {
            const reportDate = new Date(report.date);
            const startDate = startDateFilter ? new Date(startDateFilter) : null;
            const endDate = endDateFilter ? new Date(endDateFilter) : null;

            return (
                (clientFilter === '' || report.clientName.toLowerCase().includes(clientFilter)) &&
                (projectFilter === '' || report.projectName.toLowerCase().includes(projectFilter)) &&
                (employeeFilter === '' || report.employeeName.toLowerCase().includes(employeeFilter)) &&
                (!startDate || reportDate >= startDate) &&
                (!endDate || reportDate <= endDate)
            );
        });
        renderReports();
    };

    const populateFilterDropdowns = () => {
        const clientFilter = document.getElementById('client-filter');
        const projectFilter = document.getElementById('project-filter');
        const employeeFilter = document.getElementById('employee-filter');

        const clients = [...new Set(reports.map(r => r.clientName).filter(Boolean))];
        const projects = [...new Set(reports.map(r => r.projectName).filter(Boolean))];
        const employees = [...new Set(reports.map(r => r.employeeName).filter(Boolean))];

        const setOptions = (select, values, label) => {
            select.innerHTML = `<option value="">All ${label}</option>` +
                values.map(v => `<option value="${v}">${v}</option>`).join('');
        };
        setOptions(clientFilter, clients, 'Clients');
        setOptions(projectFilter, projects, 'Projects');
        setOptions(employeeFilter, employees, 'Employees');
    };

    const addOrUpdateReport = async (e) => {
        e.preventDefault();
        const reportData = {
            date: document.getElementById('date').value,
            employeeName: document.getElementById('employee-name').value,
            clientName: document.getElementById('client-name').value,
            projectName: document.getElementById('project-name').value,
            taskDescription: document.getElementById('task-description').value,
            hours: document.getElementById('hours').value,
            notes: document.getElementById('notes').value,
        };

        if (editId !== null) {
            reports = reports.map(report =>
                report.id === editId ? { ...report, ...reportData } : report
            );
        } else {
            reports.push({ ...reportData, id: Date.now() });
        }

        await saveReports(reports);
        populateFilterDropdowns();
        applyFilters();
        cancelEdit();
        addReportForm.reset();
    };

    const handleTableClick = (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;

        const id = Number(row.getAttribute('data-id'));

        if (target.closest('.edit-btn')) {
            startEditReport(id);
        } else if (target.closest('.delete-btn')) {
            deleteReport(id);
        }
    };

    const startEditReport = (id) => {
        const reportToEdit = reports.find(report => report.id === id);
        if (reportToEdit) {
            document.getElementById('date').value = reportToEdit.date;
            document.getElementById('employee-name').value = reportToEdit.employeeName;
            document.getElementById('client-name').value = reportToEdit.clientName;
            document.getElementById('project-name').value = reportToEdit.projectName;
            document.getElementById('task-description').value = reportToEdit.taskDescription;
            document.getElementById('hours').value = reportToEdit.hours;
            document.getElementById('notes').value = reportToEdit.notes;

            editId = id;
            addReportForm.querySelector('button[type="submit"]').textContent = 'Update Report';
            addReportForm.querySelector('button[type="submit"]').classList.add('update');
            cancelBtn.style.display = 'block';
        }
    };

    const deleteReport = async (id) => {
        if (confirm('Are you sure you want to delete this report?')) {
            reports = reports.filter(report => report.id !== id);
            await saveReports(reports);
            populateFilterDropdowns();
            applyFilters();
        }
    };

    const cancelEdit = () => {
        editId = null;
        addReportForm.reset();
        addReportForm.querySelector('button[type="submit"]').textContent = 'Add Report';
        addReportForm.querySelector('button[type="submit"]').classList.remove('update');
        cancelBtn.style.display = 'none';
    };

    const exportToExcel = () => {
        let totalHours = 0;
        const dataToExport = filteredReports.map(report => {
            const hoursWorked = parseFloat(report.hours || 0).toFixed(2);
            totalHours += parseFloat(hoursWorked);
            return {
                'Date': formatDateDMY(report.date),
                'Employee': report.employeeName,
                'Client': report.clientName,
                'Project': report.projectName,
                'Task Description': report.taskDescription,
                'Hours': hoursWorked,
                'Notes': report.notes
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', '', 'Total Hours:', totalHours.toFixed(2)]], { origin: -1 });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reports');
        XLSX.writeFile(wb, 'Workbook_Reports.xlsx');
    };

    addReportForm.addEventListener('submit', addOrUpdateReport);
    exportBtn.addEventListener('click', exportToExcel);
    filterBtn.addEventListener('click', applyFilters);
    cancelBtn.addEventListener('click', cancelEdit);
    reportBody.addEventListener('click', handleTableClick);

    initialize();
});