
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        tokenVersion: {
            type: Number,
            default: 0,
        },

        // Password reset OTP
        resetPasswordOtp: {
            type: String,
        },

        resetPasswordOtpExpires: {
            type: Date,
        },

        // Prevent OTP brute-force attempts
        resetPasswordOtpAttempts: {
            type: Number,
            default: 0,
        },

        // Prevent requesting OTP repeatedly
        resetPasswordOtpLastSent: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Admin', adminSchema);

