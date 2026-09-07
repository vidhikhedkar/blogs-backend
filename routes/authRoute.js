const express = require('express');

const router = express.Router();

const {
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    checkAuthStatus,
} = require('../controller/authController');


router.post('/register', registerAdmin);

router.post('/login', loginAdmin);

router.post('/logout', logoutAdmin);

router.get('/check-auth', checkAuthStatus);


// Password reset
router.post('/forgot-password', forgotPassword);

router.post('/verify-reset-otp', verifyResetOtp);

router.post('/reset-password', resetPassword);


module.exports = router;