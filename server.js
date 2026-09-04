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

connectDB();

app.use(helmet());
const allowedOrigins = [
    'http://localhost:5173',
    '',
    ''];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            const msg =
                'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }

        return callback(null, true);
    },
    credentials: true,
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});

app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api', blogRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        error: 'Endpoint not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong on the server.'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Secure backend running on port ${PORT}`);
});