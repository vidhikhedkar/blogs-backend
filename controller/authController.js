
const Admin = require('../model/adminSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BrevoClient } = require('@getbrevo/brevo');

const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
});


// ============================================================
// REGISTER ADMIN
// ============================================================

const registerAdmin = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'Username, email and password are required.',
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existingAdmin = await Admin.findOne({
            email: normalizedEmail,
        });

        if (existingAdmin) {
            return res.status(400).json({
                message: 'Admin already exists.',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters long.',
            });
        }

        const salt = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(
            password,
            salt
        );

        const newAdmin = new Admin({
            username,
            email: normalizedEmail,
            password: hashedPassword,
            tokenVersion: 0,
        });

        const savedAdmin = await newAdmin.save();

        res.status(201).json({
            message: 'Admin created successfully',
            adminId: savedAdmin._id,
        });

    } catch (err) {
        console.error('Register Admin Error:', err);

        res.status(500).json({
            error: err.message,
        });
    }
};


// ============================================================
// LOGIN ADMIN
// ============================================================

const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required.',
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const admin = await Admin.findOne({
            email: normalizedEmail,
        });

        if (!admin) {
            return res.status(400).json({
                message: 'Invalid email or password.',
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            admin.password
        );

        if (!isMatch) {
            return res.status(400).json({
                message: 'Invalid email or password.',
            });
        }

        // Invalidate previous login sessions
        admin.tokenVersion += 1;

        await admin.save();

        const token = jwt.sign(
            {
                id: admin._id,
                version: admin.tokenVersion,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '1d',
            }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            message: 'Logged in successfully',
            username: admin.username,
        });

    } catch (err) {
        console.error('Login Error:', err);

        res.status(500).json({
            error: err.message,
        });
    }
};


// ============================================================
// FORGOT PASSWORD - SEND OTP
// ============================================================

const forgotPassword = async (req, res) => {
    let admin;

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email is required.',
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        admin = await Admin.findOne({
            email: normalizedEmail,
        });

        if (!admin) {
            return res.status(404).json({
                message: 'Admin with this email does not exist.',
            });
        }

        // ----------------------------------------------------
        // Prevent OTP spam
        // Allow one OTP request every 60 seconds
        // ----------------------------------------------------

        const now = Date.now();

        if (
            admin.resetPasswordOtpLastSent &&
            now -
                new Date(
                    admin.resetPasswordOtpLastSent
                ).getTime() <
                60 * 1000
        ) {
            const remainingSeconds = Math.ceil(
                (
                    60 * 1000 -
                    (
                        now -
                        new Date(
                            admin.resetPasswordOtpLastSent
                        ).getTime()
                    )
                ) / 1000
            );

            return res.status(429).json({
                message: `Please wait ${remainingSeconds} second(s) before requesting another OTP.`,
            });
        }


        // ----------------------------------------------------
        // Generate 6 digit OTP
        // ----------------------------------------------------

        const otp = crypto
            .randomInt(100000, 1000000)
            .toString();


        // ----------------------------------------------------
        // Hash OTP before storing
        // ----------------------------------------------------

        const hashedOtp = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');


        // ----------------------------------------------------
        // Save OTP information
        // OTP expires after 10 minutes
        // ----------------------------------------------------

        admin.resetPasswordOtp = hashedOtp;

        admin.resetPasswordOtpExpires =
            new Date(Date.now() + 10 * 60 * 1000);

        admin.resetPasswordOtpAttempts = 0;

        admin.resetPasswordOtpLastSent = new Date();

        await admin.save();


        // ----------------------------------------------------
        // Email HTML
        // ----------------------------------------------------

        const emailContent = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    />

    <title>Password Reset OTP</title>
</head>

<body
    style="
        margin: 0;
        padding: 0;
        background-color: #f5f7fb;
        font-family: Arial, Helvetica, sans-serif;
    "
>

    <div
        style="
            width: 100%;
            padding: 40px 20px;
            box-sizing: border-box;
        "
    >

        <div
            style="
                max-width: 560px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid #e5e7eb;
            "
        >

            <!-- HEADER -->

            <div
                style="
                    background-color: #111827;
                    padding: 28px 20px;
                    text-align: center;
                "
            >

                <h1
                    style="
                        margin: 0;
                        color: #ffffff;
                        font-size: 24px;
                        font-weight: 700;
                    "
                >
                    Password Reset
                </h1>

            </div>


            <!-- CONTENT -->

            <div
                style="
                    padding: 35px 30px;
                "
            >

                <p
                    style="
                        margin: 0 0 18px;
                        color: #374151;
                        font-size: 16px;
                        line-height: 1.6;
                    "
                >
                    Hello
                    <strong>${admin.username}</strong>,
                </p>


                <p
                    style="
                        margin: 0 0 18px;
                        color: #374151;
                        font-size: 16px;
                        line-height: 1.6;
                    "
                >
                    We received a request to reset the password
                    for your administrator account.
                </p>


                <p
                    style="
                        margin: 0 0 20px;
                        color: #374151;
                        font-size: 16px;
                        line-height: 1.6;
                    "
                >
                    Please use the verification code below to
                    continue with your password reset:
                </p>


                <!-- OTP -->

                <div
                    style="
                        text-align: center;
                        margin: 30px 0;
                    "
                >

                    <div
                        style="
                            display: inline-block;
                            background-color: #f3f4f6;
                            border: 1px solid #d1d5db;
                            border-radius: 10px;
                            padding: 18px 30px;
                        "
                    >

                        <span
                            style="
                                font-size: 32px;
                                font-weight: 700;
                                letter-spacing: 8px;
                                color: #111827;
                            "
                        >
                            ${otp}
                        </span>

                    </div>

                </div>


                <!-- EXPIRY -->

                <p
                    style="
                        margin: 0 0 20px;
                        text-align: center;
                        color: #6b7280;
                        font-size: 14px;
                    "
                >
                    This OTP is valid for
                    <strong>10 minutes</strong>.
                </p>


                <!-- INSTRUCTIONS -->

                <div
                    style="
                        margin: 25px 0;
                        padding: 15px;
                        background-color: #f9fafb;
                        border-radius: 8px;
                    "
                >

                    <p
                        style="
                            margin: 0;
                            color: #4b5563;
                            font-size: 14px;
                            line-height: 1.6;
                        "
                    >
                        Enter this OTP on the password reset page
                        to verify your identity and create a new
                        password.
                    </p>

                </div>


                <!-- SECURITY MESSAGE -->

                <p
                    style="
                        margin: 25px 0 0;
                        color: #6b7280;
                        font-size: 13px;
                        line-height: 1.6;
                    "
                >
                    If you did not request a password reset,
                    you can safely ignore this email.
                    Your password will remain unchanged.
                </p>

            </div>


            <!-- FOOTER -->

            <div
                style="
                    padding: 20px;
                    background-color: #f9fafb;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                "
            >

                <p
                    style="
                        margin: 0;
                        color: #9ca3af;
                        font-size: 12px;
                    "
                >
                    This is an automated email.
                    Please do not reply.
                </p>

            </div>

        </div>

    </div>

</body>

</html>
`;


        // ----------------------------------------------------
        // Send email through Brevo
        // ----------------------------------------------------

        await brevo.transactionalEmails.sendTransacEmail({

            sender: {
                name: process.env.SENDER_NAME,
                email: process.env.SENDER_EMAIL,
            },

            to: [
                {
                    email: admin.email,
                    name: admin.username,
                },
            ],

            subject: 'Password Reset OTP',

            htmlContent: emailContent,
        });


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        res.json({
            message: 'OTP sent successfully to your email.',
        });

    } catch (err) {

        console.error(
            'Forgot Password Error:',
            err
        );


        // ----------------------------------------------------
        // Clean OTP if email sending failed
        // ----------------------------------------------------

        if (admin) {

            admin.resetPasswordOtp = undefined;

            admin.resetPasswordOtpExpires =
                undefined;

            admin.resetPasswordOtpAttempts = 0;

            admin.resetPasswordOtpLastSent =
                undefined;

            await admin.save();
        }


        res.status(500).json({
            message:
                'Unable to send OTP. Please try again later.',
        });
    }
};


// ============================================================
// VERIFY RESET OTP
// ============================================================

const verifyResetOtp = async (req, res) => {

    try {

        const { email, otp } = req.body;


        if (!email || !otp) {

            return res.status(400).json({
                message:
                    'Email and OTP are required.',
            });
        }


        const normalizedEmail =
            email.toLowerCase().trim();


        const cleanOtp =
            otp.toString().trim();


        // OTP must be exactly 6 digits

        if (!/^\d{6}$/.test(cleanOtp)) {

            return res.status(400).json({
                message:
                    'OTP must be a 6-digit number.',
            });
        }


        const admin = await Admin.findOne({
            email: normalizedEmail,
        });


        if (!admin) {

            return res.status(404).json({
                message: 'Admin not found.',
            });
        }


        // ----------------------------------------------------
        // Check active OTP
        // ----------------------------------------------------

        if (
            !admin.resetPasswordOtp ||
            !admin.resetPasswordOtpExpires
        ) {

            return res.status(400).json({
                message:
                    'No active OTP found. Please request a new OTP.',
            });
        }


        // ----------------------------------------------------
        // Check expiry
        // ----------------------------------------------------

        if (
            new Date(
                admin.resetPasswordOtpExpires
            ).getTime() < Date.now()
        ) {

            admin.resetPasswordOtp = undefined;

            admin.resetPasswordOtpExpires =
                undefined;

            admin.resetPasswordOtpAttempts = 0;

            admin.resetPasswordOtpLastSent =
                undefined;

            await admin.save();


            return res.status(400).json({
                message:
                    'OTP has expired. Please request a new OTP.',
            });
        }


        // ----------------------------------------------------
        // Maximum 5 attempts
        // ----------------------------------------------------

        if (
            admin.resetPasswordOtpAttempts >= 5
        ) {

            admin.resetPasswordOtp = undefined;

            admin.resetPasswordOtpExpires =
                undefined;

            admin.resetPasswordOtpAttempts = 0;

            admin.resetPasswordOtpLastSent =
                undefined;

            await admin.save();


            return res.status(429).json({
                message:
                    'Too many incorrect OTP attempts. Please request a new OTP.',
            });
        }


        // ----------------------------------------------------
        // Hash submitted OTP
        // ----------------------------------------------------

        const hashedOtp = crypto
            .createHash('sha256')
            .update(cleanOtp)
            .digest('hex');


        // ----------------------------------------------------
        // Compare OTP
        // ----------------------------------------------------

        if (
            hashedOtp !==
            admin.resetPasswordOtp
        ) {

            admin.resetPasswordOtpAttempts += 1;

            await admin.save();


            const attemptsLeft =
                5 -
                admin.resetPasswordOtpAttempts;


            return res.status(400).json({
                message:
                    attemptsLeft > 0
                        ? `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
                        : 'Invalid OTP.',
            });
        }


        // ----------------------------------------------------
        // OTP verified successfully
        // Remove OTP immediately
        // ----------------------------------------------------

        admin.resetPasswordOtp = undefined;

        admin.resetPasswordOtpExpires =
            undefined;

        admin.resetPasswordOtpAttempts = 0;

        admin.resetPasswordOtpLastSent =
            undefined;

        await admin.save();


        // ----------------------------------------------------
        // Create temporary reset session
        // Valid for 5 minutes
        // ----------------------------------------------------

        const resetSessionToken = jwt.sign(
            {
                id: admin._id,
                purpose: 'password_reset',
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '5m',
            }
        );


        res.json({
            message:
                'OTP verified successfully.',

            resetSessionToken,
        });

    } catch (err) {

        console.error(
            'Verify OTP Error:',
            err
        );

        res.status(500).json({
            error: err.message,
        });
    }
};


// ============================================================
// RESET PASSWORD
// ============================================================

const resetPassword = async (req, res) => {

    try {

        const {
            resetSessionToken,
            newPassword,
        } = req.body;


        if (!resetSessionToken) {

            return res.status(400).json({
                message:
                    'Authorization failed. No reset session provided.',
            });
        }


        if (!newPassword) {

            return res.status(400).json({
                message:
                    'New password is required.',
            });
        }


        // ----------------------------------------------------
        // Password validation
        // ----------------------------------------------------

        if (newPassword.length < 6) {

            return res.status(400).json({
                message:
                    'Password must be at least 6 characters long.',
            });
        }


        // ----------------------------------------------------
        // Verify reset session
        // ----------------------------------------------------

        let decoded;

        try {

            decoded = jwt.verify(
                resetSessionToken,
                process.env.JWT_SECRET
            );


            if (
                decoded.purpose !==
                'password_reset'
            ) {

                throw new Error(
                    'Invalid token purpose'
                );
            }

        } catch (err) {

            return res.status(400).json({
                message:
                    'Reset session expired or invalid. Please request a new OTP.',
            });
        }


        // ----------------------------------------------------
        // Find admin
        // ----------------------------------------------------

        const admin = await Admin.findById(
            decoded.id
        );


        if (!admin) {

            return res.status(404).json({
                message: 'Admin not found.',
            });
        }


        // ----------------------------------------------------
        // Hash new password
        // ----------------------------------------------------

        const salt =
            await bcrypt.genSalt(10);


        admin.password =
            await bcrypt.hash(
                newPassword,
                salt
            );


        // ----------------------------------------------------
        // Invalidate all existing sessions
        // ----------------------------------------------------

        admin.tokenVersion += 1;


        // ----------------------------------------------------
        // Save password
        // ----------------------------------------------------

        await admin.save();


        res.json({
            message:
                'Password reset successfully. You can now login.',
        });

    } catch (err) {

        console.error(
            'Reset Password Error:',
            err
        );

        res.status(500).json({
            error: err.message,
        });
    }
};


// ============================================================
// LOGOUT ADMIN
// ============================================================

const logoutAdmin = async (req, res) => {

    try {

        if (
            req.admin &&
            req.admin.id
        ) {

            await Admin.findByIdAndUpdate(
                req.admin.id,
                {
                    $inc: {
                        tokenVersion: 1,
                    },
                }
            );
        }

    } catch (err) {

        console.error(
            'Logout Error:',
            err
        );
    }


    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
    });


    res.json({
        message:
            'Logged out successfully',
    });
};


// ============================================================
// CHECK AUTH STATUS
// ============================================================

const checkAuthStatus = async (req, res) => {

    try {

        const token =
            req.cookies.token;


        if (!token) {

            return res.status(401).json({
                isAuthenticated: false,
                message:
                    'No token provided',
            });
        }


        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        const admin = await Admin.findById(
            decoded.id
        );


        if (
            !admin ||
            admin.tokenVersion !==
                decoded.version
        ) {

            return res.status(401).json({
                isAuthenticated: false,
                message:
                    'Invalid session',
            });
        }


        res.json({
            isAuthenticated: true,
            username: admin.username,
        });

    } catch (err) {

        res.status(401).json({
            isAuthenticated: false,
            message:
                'Session expired or invalid',
        });
    }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    registerAdmin,

    loginAdmin,

    logoutAdmin,

    forgotPassword,

    verifyResetOtp,

    resetPassword,

    checkAuthStatus,

};

