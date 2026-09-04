const jwt = require('jsonwebtoken');
const Admin = require('../model/adminSchema');

const verifyToken = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided in cookies.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        // Find admin and verify token version matches
        const admin = await Admin.findById(verified.id);
        if (!admin || admin.tokenVersion !== verified.version) {
            return res.status(403).json({ message: 'Token has been expired or invalidated. Please login again.' });
        }

        req.admin = admin;
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = { verifyToken };