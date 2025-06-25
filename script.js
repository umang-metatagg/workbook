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
    const API_URL = 'https://workbook-voxn.onrender.com/reports';

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

    // Helper to sort reports by ID (descending)
    function sortReportsDescending(reportsArr) {
        return reportsArr.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    // Load reports and initialize
    const initialize = async () => {
        reports = await fetchReports();
        reports = sortReportsDescending(reports);
        filteredReports = [...reports];
        populateFilterDropdowns();
        applyFilters();
    };

    // Helper to format date as DD-MM-YYYY
    function formatDateDMY(dateStr) {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
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
                <td class="date-cell">${formatDateDMY(report.date)}</td>
                <td>${report.employeeName}</td>
                <td>${report.clientName}</td>
                <td>${report.projectName}</td>
                <td>${report.taskDescription}</td>
                <td>${hoursWorked}</td>
                <td>${report.notes}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                    </div>
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

        reports = sortReportsDescending(reports);
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
        // Sort and group reports by project
        const sortedReports = [...filteredReports].sort((a, b) => a.projectName.localeCompare(b.projectName));
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
                'Date': formatDateDMY(report.date),
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

        // Set row height to 15pt (≈20px) for all rows
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
    };

    addReportForm.addEventListener('submit', addOrUpdateReport);
    exportBtn.addEventListener('click', exportToExcel);
    filterBtn.addEventListener('click', applyFilters);
    cancelBtn.addEventListener('click', cancelEdit);
    reportBody.addEventListener('click', handleTableClick);

    initialize();
});