const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    date: {
        type: String, // Keep as string for simplicity in form input type="date"
        required: true
    },
    employeeName: { // This will store the fullName at the time of report creation
        type: String,
        required: true
    },
    employeeUsername: { // NEW: Store the stable username for linking
        type: String,
        required: true
    },
    clientName: {
        type: String,
        required: true
    },
    projectName: {
        type: String,
        required: true
    },
    taskDescription: {
        type: String,
        required: true
    },
    hours: {
        type: Number,
        required: true,
        min: 0.1 // Ensure positive hours
    },
    notes: {
        type: String
    }
}, { timestamps: true }); // Add timestamps for created/updated dates

module.exports = mongoose.model('Report', ReportSchema);