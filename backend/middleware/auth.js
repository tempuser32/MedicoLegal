const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Middleware to verify admin
const verifyAdmin = async (req, res, next) => {
    try {
        verifyToken(req, res, async () => {
            const user = await User.findById(req.user.id);
            if (!user.isAdmin && !user.isSuperAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }
            next();
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

// Middleware to verify superadmin
const verifySuperAdmin = async (req, res, next) => {
    try {
        verifyToken(req, res, async () => {
            const user = await User.findById(req.user.id);
            if (!user.isSuperAdmin) {
                return res.status(403).json({ message: 'Superadmin access required' });
            }
            next();
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

// Middleware to verify medical staff
const verifyMedical = async (req, res, next) => {
    try {
        verifyToken(req, res, async () => {
            const user = await User.findById(req.user.id);
            if (user.userType !== 'medical') {
                return res.status(403).json({ message: 'Medical staff access required' });
            }
            next();
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

// Middleware to verify legal professional
const verifyLegal = async (req, res, next) => {
    try {
        verifyToken(req, res, async () => {
            const user = await User.findById(req.user.id);
            if (user.userType !== 'legal') {
                return res.status(403).json({ message: 'Legal professional access required' });
            }
            next();
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    verifyToken,
    verifyAdmin,
    verifySuperAdmin,
    verifyMedical,
    verifyLegal
};