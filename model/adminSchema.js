const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);