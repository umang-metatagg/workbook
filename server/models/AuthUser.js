const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AuthUserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    fullName: { // This field will now serve as the employee name for reports
        type: String,
        required: true, // Make fullName required for all AuthUsers (especially employees)
        trim: true,
    },
    role: {
        type: String,
        enum: ['employee', 'admin'],
        default: 'employee',
    },
});

// Hash password before saving the user
AuthUserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare entered password with hashed password
AuthUserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('AuthUser', AuthUserSchema);