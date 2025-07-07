const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
    name: { // This is the display label
        type: String,
        required: true,
        unique: true, // Name should also remain unique for easier management
        trim: true
    },
    slug: { // This is the stable identifier
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Client', ClientSchema);