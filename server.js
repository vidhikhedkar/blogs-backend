require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const blogRoutes = require('./routes/blogroute');
const authRoutes = require('./routes/authRoute');

const app = express();
const PORT = process.env.PORT || 8080;

// Connect to Database
connectDB();

// Dynamic Allowed Origins based on environment variables
const allowedOrigins = [
    'http://localhost:5173',
    process.env.CLIENT_URL // Add your production frontend URL in Render Environment Variables
].filter(Boolean); // Removes empty values to avoid CORS logic issues

app.use(helmet());

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman, or server-to-server)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }

        return callback(null, true);
    },
    credentials: true,
}));

// Express Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});

app.use('/api/', limiter);

// Body Parsers & Cookie Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Root Health Check Route (Useful to test Render deployment in browser)
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server is running successfully on Render!' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', blogRoutes);

// Catch-all 404 Handler for Undefined Routes
app.use((req, res, next) => {
    res.status(404).json({
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack || err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Something went wrong on the server.'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Secure backend running on port ${PORT}`);
});