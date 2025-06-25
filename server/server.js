const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reports.json');

app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// GET reports
app.get('/reports', (req, res) => {
    if (!fs.existsSync(DATA_FILE)) {
        return res.json([]);
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    res.json(JSON.parse(data || '[]'));
});

// POST reports (replace all)
app.post('/reports', (req, res) => {
    const reports = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 