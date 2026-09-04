const Admin = require('../model/adminSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BrevoClient } = require('@getbrevo/brevo');

const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
});

const forgotPassword = async (req, res) => {
    let admin;
    try {
        const { email } = req.body;
        admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({ message: 'Admin with this email does not exist.' });

        const fifteenMinutesInMs = 15 * 60 * 1000;
        const oneMinuteInMs = 1 * 60 * 1000;

        if (admin.resetPasswordExpires && admin.resetPasswordExpires > (Date.now() + (fifteenMinutesInMs - oneMinuteInMs))) {
            const timeLeftSeconds = Math.ceil((admin.resetPasswordExpires - (fifteenMinutesInMs - oneMinuteInMs) - Date.now()) / 1000);
            return res.status(429).json({
                message: `Please wait ${timeLeftSeconds} second(s) before requesting another password reset link.`
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        admin.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        admin.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
        await admin.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        await brevo.transactionalEmails.sendTransacEmail({
            subject: 'Password Reset Request',
            htmlContent: `
                <p>You requested a password reset.</p>
                <p>Please click this link to reset your password:</p>
                <a href="${resetUrl}" target="_blank">${resetUrl}</a>
                <p>This link will expire in 15 minutes.</p>
            `,
            sender: {
                name: process.env.SENDER_NAME,
                email: process.env.SENDER_EMAIL
            },
            to: [{ email: admin.email, name: admin.username }]
        });

        res.json({ message: 'Password reset link sent to your email.' });
    } catch (err) {
        if (admin) {
            admin.resetPasswordToken = undefined;
            admin.resetPasswordExpires = undefined;
            await admin.save();
        }
        res.status(500).json({ error: err.message });
    }
};

// STEP 1: Triggered the moment the user clicks the email link & loads the UI.
// This validates the token AND instantly burns it so it can never be reused.
const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const admin = await Admin.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!admin) {
            return res.status(400).json({ message: 'Token is expired or invalid.' });
        }

        // BURN THE TOKEN IMMEDIATELY so clicking it a second time fails
        admin.resetPasswordToken = undefined;
        admin.resetPasswordExpires = undefined;
        await admin.save();

        // Issue a short-lived temporary token (5 minutes) just for this password reset session
        const resetSessionToken = jwt.sign(
            { id: admin._id, purpose: 'password_reset' },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        res.json({
            message: 'Token is valid.',
            resetSessionToken // Send this to frontend to pass back when submitting the new password
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// STEP 2: Triggered when the user submits their new password form
const resetPassword = async (req, res) => {
    try {
        const { resetSessionToken, newPassword } = req.body;

        if (!resetSessionToken) {
            return res.status(400).json({ message: 'Authorization failed. No reset session provided.' });
        }

        // Verify the temporary reset session token
        let decoded;
        try {
            decoded = jwt.verify(resetSessionToken, process.env.JWT_SECRET);
            if (decoded.purpose !== 'password_reset') {
                throw new Error('Invalid token purpose');
            }
        } catch (err) {
            return res.status(400).json({ message: 'Reset session expired or invalid. Please request a new password reset.' });
        }

        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(newPassword, salt);

        // Invalidate all existing login sessions across devices
        admin.tokenVersion += 1;
        await admin.save();

        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const registerAdmin = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) return res.status(400).json({ message: 'Admin already exists.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAdmin = new Admin({
            username,
            email,
            password: hashedPassword
        });

        const savedAdmin = await newAdmin.save();
        res.status(201).json({ message: 'Admin created successfully', adminId: savedAdmin._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });

        if (!admin) return res.status(400).json({ message: 'Invalid email or password.' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password.' });

        admin.tokenVersion += 1;
        await admin.save();

        const token = jwt.sign(
            { id: admin._id, version: admin.tokenVersion },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
            message: 'Logged in successfully',
            username: admin.username
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const logoutAdmin = async (req, res) => {
    try {
        if (req.admin && req.admin.id) {
            await Admin.findByIdAndUpdate(req.admin.id, { $inc: { tokenVersion: 1 } });
        }
    } catch (e) { }

    // Attributes MUST match loginAdmin cookie settings to properly clear
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.json({ message: 'Logged out successfully' });
};




// Add this to your existing authController.js imports & exports
const checkAuthStatus = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ isAuthenticated: false, message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);

        if (!admin || admin.tokenVersion !== decoded.version) {
            return res.status(401).json({ isAuthenticated: false, message: 'Invalid session' });
        }

        res.json({ isAuthenticated: true, username: admin.username });
    } catch (err) {
        res.status(401).json({ isAuthenticated: false, message: 'Session expired or invalid' });
    }
};




module.exports = {
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    forgotPassword,
    verifyResetToken,
    resetPassword, checkAuthStatus
};