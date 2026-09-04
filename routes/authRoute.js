const express = require('express');
const { forgotPassword, resetPassword, registerAdmin, loginAdmin, logoutAdmin, verifyResetToken, checkAuthStatus } = require('../controller/authController');
const router = express.Router();


router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.post('/logout', logoutAdmin);
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password', resetPassword);
router.get('/verify-auth', checkAuthStatus); // <-- NEW COOKIE VERIFICATION ROUTE

module.exports = router;