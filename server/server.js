require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const Client = require('./models/Client');
const Report = require('./models/Report');
const AuthUser = require('./models/AuthUser');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not defined in .env');
    process.exit(1);
}
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not defined in .env');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

const generateToken = (id, username, role, fullName) => {
    return jwt.sign({ id, username, role, fullName }, JWT_SECRET, { expiresIn: '1h' });
};

const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded; // req.user will now have { id, username, role, fullName } after login
            next();
        } catch (error) {
            console.error('Not authorized, token failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed or expired' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return (req, res, next) => {
        if (!req.user || (roles.length > 0 && !roles.includes(req.user.role))) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
        }
        next();
    };
};

/* ----------------- AUTHENTICATION & USER ACCOUNT MANAGEMENT (AuthUser Model - Unified) ----------------- */

app.post('/api/auth/register', protect, authorize('admin'), async (req, res) => {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName) {
        return res.status(400).json({ message: 'Please enter all required fields: username, password, and full name.' });
    }
    try {
        const userExists = await AuthUser.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists with this username' });
        }
        // Check fullName uniqueness for employee role to avoid duplicate names in dropdown
        // This check is important as fullName is displayed in reports
        if (role === 'employee') {
            const fullNameExists = await AuthUser.findOne({ fullName: fullName, role: 'employee' });
            if (fullNameExists) {
                return res.status(400).json({ message: 'An employee with this full name already exists. Please use a unique full name.' });
            }
        }

        const authUser = await AuthUser.create({
            username,
            password,
            fullName,
            role: role || 'employee',
        });

        if (authUser) {
            res.status(201).json({
                _id: authUser._id,
                username: authUser.username,
                fullName: authUser.fullName,
                role: authUser.role,
                message: 'User account created successfully!'
            });
        } else {
            res.status(400).json({ message: 'Invalid user data provided' });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await AuthUser.findOne({ username });
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                token: generateToken(user._id, user.username, user.role, user.fullName),
            });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/auth/users', protect, authorize('admin'), async (req, res) => {
    try {
        const authUsers = await AuthUser.find().select('-password');
        res.json(authUsers);
    } catch (error) {
        console.error('Error fetching AuthUsers:', error);
        res.status(500).json({ message: 'Server error fetching AuthUsers' });
    }
});

app.get('/api/auth/employees', protect, async (req, res) => {
    try {
        const employees = await AuthUser.find({ role: 'employee' }).select('_id fullName username'); // Added username
        res.json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ message: 'Server error fetching employees' });
    }
});

app.put('/api/auth/users/:id', protect, authorize('admin'), async (req, res) => {
    const { username, fullName, role, password } = req.body; // username will come, but we ignore it for updates
    try {
        const authUser = await AuthUser.findById(req.params.id);
        if (!authUser) {
            return res.status(404).json({ message: 'AuthUser not found' });
        }

        if (password) {
            authUser.password = password; 
        }

        if (fullName !== undefined) authUser.fullName = fullName;
        if (role !== undefined) authUser.role = role;

        /*
        if (req.body.password) {
            console.log('Hashing new password...'); // ADD THIS LINE
            const salt = await bcrypt.genSalt(10);
            authUser.password = await bcrypt.hash(req.body.password, salt);
            console.log('Password hashed successfully.'); // ADD THIS LINE
        }
        */

        await authUser.save();
        res.json({
            _id: authUser._id,
            username: authUser.username, // Send back original username
            fullName: authUser.fullName,
            role: authUser.role,
            message: 'AuthUser updated successfully!'
        });

    } catch (error) {
        console.error('Error updating AuthUser:', error);
        res.status(500).json({ message: 'Server error updating AuthUser' });
    }
});

app.delete('/api/auth/users/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const authUser = await AuthUser.findById(req.params.id);
        if (!authUser) {
            return res.status(404).json({ message: 'AuthUser not found' });
        }
        if (req.user.id === req.params.id) {
            return res.status(403).json({ message: 'Cannot delete your own active admin account.' });
        }

        await AuthUser.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'AuthUser deleted successfully' });
    } catch (error) {
        console.error('Error deleting AuthUser:', error);
        res.status(500).json({ message: 'Server error deleting AuthUser' });
    }
});


/* ----------------- CLIENT MANAGEMENT ROUTES (Unchanged) ----------------- */

app.get('/clients', protect, async (req, res) => {
    try {
        const clients = await Client.find();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/clients', protect, authorize('admin'), async (req, res) => {
    let { name, slug } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    // Auto-generate slug if not provided, or ensure it's valid
    if (!slug) {
        slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
    } else {
        slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
    }
    if (!slug) return res.status(400).json({ error: 'Generated slug is empty. Please provide a valid client name.' });

    try {
        const clientExistsByName = await Client.findOne({ name });
        if (clientExistsByName) {
            return res.status(400).json({ message: 'Client with this name already exists.' });
        }
        const clientExistsBySlug = await Client.findOne({ slug });
        if (clientExistsBySlug) {
            return res.status(400).json({ message: 'Client with this slug already exists. Please choose a different name or provide a unique slug.' });
        }

        const client = new Client({ name, slug });
        await client.save();
        res.status(201).json(client);
    } catch (error) {
        console.error('Error creating client:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.put('/clients/:id', protect, authorize('admin'), async (req, res) => {
    let { name, slug } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    // Auto-generate slug if not provided, or ensure it's valid
    if (!slug) {
        slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
    } else {
        slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
    }
    if (!slug) return res.status(400).json({ error: 'Generated slug is empty. Please provide a valid client name.' });

    try {
        // Check for duplicate name excluding the current client
        const clientExistsByName = await Client.findOne({ name, _id: { $ne: req.params.id } });
        if (clientExistsByName) {
            return res.status(400).json({ message: 'Another client with this name already exists.' });
        }
        // Check for duplicate slug excluding the current client
        const clientExistsBySlug = await Client.findOne({ slug, _id: { $ne: req.params.id } });
        if (clientExistsBySlug) {
            return res.status(400).json({ message: 'Another client with this slug already exists. Please choose a different name or provide a unique slug.' });
        }

        const client = await Client.findByIdAndUpdate(req.params.id, { name, slug }, { new: true });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        res.json(client);
    } catch (error) {
        console.error('Error updating client:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/clients/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const clientToDelete = await Client.findById(req.params.id);
        if (!clientToDelete) return res.status(404).json({ error: 'Client not found' });

        // IMPORTANT: Before deleting a client, consider its impact on existing reports.
        // Option 1: Prevent deletion if reports are linked (recommended for data integrity)
        const reportsExist = await Report.findOne({ clientName: clientToDelete.slug }); // Assuming report stores client slug
        if (reportsExist) {
            return res.status(400).json({ message: 'Cannot delete client: Reports are linked to this client. Please reassign or delete linked reports first.' });
        }
        // Option 2: Delete reports (not recommended without user confirmation)
        // await Report.deleteMany({ clientName: clientToDelete.slug });

        await Client.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Client deleted successfully' });
    } catch (error) {
        console.error('Error deleting client:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/* ----------------- REPORT ROUTES (Updated for employeeUsername & Dependent Filters) ----------------- */

// GET /reports: Get all reports (Admin sees all, Employee sees only their own)
app.get('/reports', protect, async (req, res) => {
    try {
        let matchQuery = {}; // Initialize an empty match query

        if (req.user.role === 'employee') {
            // Employee sees reports where employeeUsername matches their AuthUser.username
            matchQuery.employeeUsername = req.user.username;
        }
        // Admins will have an empty matchQuery, so all reports will be considered for them.

        const reports = await Report.aggregate([
        // Stage 1: Filter reports based on user role (admin sees all, employee sees their own)
        {
            $match: matchQuery
        },
        // Stage 2: Perform a left outer join with the 'clients' collection
        {
            $lookup: {
                from: 'clients', // Make sure 'clients' is the actual name of your collection
                localField: 'clientName', // Field from the 'reports' collection (the slug)
                foreignField: 'slug',     // Field from the 'clients' collection to match on
                as: 'clientDetails'       // Name of the new array field added to each report document
            }
        },
        // Stage 3: Deconstruct the 'clientDetails' array
        // Use preserveNullAndEmptyArrays: true to include reports even if no matching client is found
        {
            $unwind: {
                path: '$clientDetails',
                preserveNullAndEmptyArrays: true
            }
        },
        // Stage 4: Project (select) the fields you want in the final output
        {
            $project: {
                _id: 1,
                date: 1,
                employeeName: 1,
                // Use the 'name' (label) from clientDetails, or fall back to original clientName (slug)
                displayClientName: { $ifNull: ['$clientDetails.name', '$clientName'] },
                // Get the original clientName (slug) from the report document
                clientName: '$clientName', // <--- CORRECTED: Use just '$clientName'

                projectName: 1,
                taskDescription: 1,
                hours: 1,
                notes: 1,
                employeeUsername: 1
                // Include any other fields from your Report model you need on the frontend
            }
        },
        // Stage 5: (Optional) Add any sorting if you want the reports ordered
        {
            $sort: { date: -1 } // Example: Sort by date descending
        }
    ]);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports with client labels:', error);
        res.status(500).json({ message: 'Server error fetching reports.' });
    }
});

// POST /reports: Add a new report
app.post('/reports', protect, async (req, res) => {
    try {
        const reportData = req.body;
        // Ensure employeeUsername is set from the authenticated user's username
        if (req.user.role === 'employee' )
        { 
        reportData.employeeUsername = req.user.username;
        reportData.employeeName = req.user.fullName; // Ensure employeeName is the current fullName
        }
        // Get the client slug from the client name sent from frontend
        // Assuming frontend sends clientName as the actual name, we need to convert it to slug
        /*
        const client = await Client.findOne({ name: reportData.clientName });
        if (!client) {
            return res.status(400).json({ message: 'Invalid client selected.' });
        }
        reportData.clientName = client.slug; // Store the client's slug in the report
        */
        // If the user is an employee, ensure they are only submitting a report for themselves
        if (req.user.role === 'employee' && reportData.employeeUsername !== req.user.username) {
            return res.status(403).json({ message: 'Forbidden: Employees can only add reports for themselves.' });
        }
        const report = new Report(reportData);
        await report.save();
        res.status(201).json(report);
    } catch (error) {
        console.error('Error saving report:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUT /reports/:id: Update a report
app.put('/reports/:id', protect, async (req, res) => {
    try {
        const reportId = req.params.id;
        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        // Check ownership for employees (using employeeUsername)
        if (req.user.role === 'employee' && report.employeeUsername !== req.user.username) {
            return res.status(403).json({ message: 'Forbidden: You can only update your own reports.' });
        }

        const updateFields = {
            date: req.body.date,
            projectName: req.body.projectName,
            taskDescription: req.body.taskDescription,
            hours: req.body.hours,
            notes: req.body.notes,
            clientName: req.body.clientName,
        };

        // If clientName is being updated, convert it to slug
        /*
        if (req.body.clientName !== undefined) {
            const client = await Client.findOne({ name: req.body.clientName });
            if (!client) {
                return res.status(400).json({ message: 'Invalid client selected for update.' });
            }
            updateFields.clientName = client.slug; // Store the client's slug
        }
        */

        // Admins can also change employeeName and employeeUsername if needed (careful with this)
        if (req.user.role === 'admin') {
            if (req.body.employeeName !== undefined) updateFields.employeeName = req.body.employeeName;
            if (req.body.employeeUsername !== undefined) updateFields.employeeUsername = req.body.employeeUsername;
        } else {
             // For employees, ensure employeeName and employeeUsername are not tampered with
             updateFields.employeeName = req.user.fullName;
             updateFields.employeeUsername = req.user.username;
        }

        const updatedReport = await Report.findByIdAndUpdate(reportId, updateFields, { new: true });
        res.json(updatedReport);
    } catch (error) {
        console.error('Error updating report:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /reports/:id: Delete a report
app.delete('/reports/:id', protect, async (req, res) => {
    try {
        const reportId = req.params.id;
        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        // Check ownership for employees (using employeeUsername)
        if (req.user.role === 'employee' && report.employeeUsername !== req.user.username) {
            return res.status(403).json({ message: 'Forbidden: You can only delete your own reports.' });
        }
        await Report.findByIdAndDelete(reportId);
        res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /reports/bulk-delete: Bulk delete reports (Admin only)
app.post('/reports/bulk-delete', protect, authorize('admin'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'An array of report IDs is required' });
    }
    try {
        await Report.deleteMany({ _id: { $in: ids } });
        res.json({ success: true, message: `${ids.length} reports deleted successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW API: Get projects for a specific client
// GET /reports/projects-by-client
app.get('/reports/projects-by-client', protect, async (req, res) => {
    const { clientName } = req.query; // clientName here will be the display name from frontend dropdown
    if (!clientName) {
        return res.status(400).json({ message: 'Client name is required for filtering projects.' });
    }
    try {
        const client = await Client.findOne({ slug: clientName });
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        let query = { clientName: client.slug }; // Query by client slug
        if (req.user.role === 'employee') {
            query.employeeUsername = req.user.username;
        }
        const projects = await Report.distinct('projectName', query);
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects by client:', error);
        res.status(500).json({ message: 'Server error fetching projects.' });
    }
});

// NEW API: Get employees for a specific project (and client, if provided)
app.get('/reports/employees-by-project', protect, async (req, res) => {
    const { clientName, projectName } = req.query;
    if (!projectName) {
        return res.status(400).json({ message: 'Project name is required for filtering employees.' });
    }
    try {
        let query = { projectName };
        if (clientName) {
            query.clientName = clientName;
        }

        if (req.user.role === 'employee') {
            query.employeeUsername = req.user.username;
        }

        // --- ADD THESE CONSOLE.LOGS ---
        console.log('Constructed query for Report.distinct:', query);
        // --------------------------------

        const employeeUsernames = await Report.distinct('employeeUsername', query);

        // --- ADD THESE CONSOLE.LOGS ---
        console.log('Result from Report.distinct (employeeUsernames):', employeeUsernames);
        // --------------------------------

        const employees = await AuthUser.find({ username: { $in: employeeUsernames }, role: 'employee' }).select('fullName username');

        // --- ADD THESE CONSOLE.LOGS ---
        console.log('Final employees to send:', employees);
        // --------------------------------

        res.json(employees);
    } catch (error) {
        console.error('Error fetching employees by project:', error);
        res.status(500).json({ message: 'Server error fetching employees.' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});