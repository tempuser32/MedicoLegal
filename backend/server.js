require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const medicalRoutes = require('./routes/medical');

const app = express();

// Log startup
console.log('Starting server...');
console.log('Environment variables:', {
    MONGODB_URI: process.env.MONGODB_URI || 'Not set',
    PORT: process.env.PORT || 'Not set'
});

// Middleware
app.use(cors({
    origin: ['http://127.0.0.1:5503', 'http://localhost:5503'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB with additional options
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4
    retryWrites: true,
    w: 'majority',
    keepAlive: true,
    keepAliveInitialDelay: 300000,
    autoIndex: true
})
.then(() => {
    console.log('Successfully connected to MongoDB');
    mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
    });
    mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
    });
    
    // Check if the database is accessible
    mongoose.connection.db.admin().ping()
        .then(() => {
            console.log('Database is accessible');
            // Start server
            const PORT = process.env.PORT || 3002; // Changed to match .env
            app.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`);
                console.log('Server is ready to accept requests');
            });
        })
        .catch(err => {
            console.error('Database ping failed:', err);
            process.exit(1);
        });
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Connection details:', {
        uri: process.env.MONGODB_URI,
        timeout: 10000,
        socketTimeout: 45000
    });
    process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medical', medicalRoutes);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, '../html')));
app.use(express.static(path.join(__dirname, '../css')));
app.use(express.static(path.join(__dirname, '../js')));
app.use('/medical', express.static(path.join(__dirname, '../html/medical')));
app.use('/css/medical', express.static(path.join(__dirname, '../css/medical')));
app.use('/js/medical', express.static(path.join(__dirname, '../js/medical')));

// Serve uploaded files (with authentication)
app.use('/uploads', (req, res, next) => {
    // This middleware could be enhanced with authentication checks
    next();
}, express.static(path.join(__dirname, 'uploads')));