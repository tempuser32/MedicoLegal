const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, async () => {
        try {
            const user = await User.findById(req.user.id);
            if (!user.isAdmin && !user.isSuperAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }
            next();
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });
};

// Middleware to verify superadmin
const verifySuperAdmin = (req, res, next) => {
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

// Profile route
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user data without password
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      isApproved: user.approved,
      approvalStatus: user.approvalStatus,
      isSuperAdmin: user.isSuperAdmin,
      specialization: user.specialization,
      hospitalName: user.hospitalName,
      department: user.department,
      experience: user.experience,
      qualifications: user.qualifications,
      // Add stats for medical users
      stats: {
        recordsUploaded: 12, // Placeholder value
        consentsApproved: 5, // Placeholder value
      },
      lastLogin: new Date()
    };

    res.json(userData);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile route
router.put('/update-profile', verifyToken, async (req, res) => {
    try {
        const { name, email, phone, hospitalName, password } = req.body;
        
        // Find user by ID
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update user fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (hospitalName) user.hospitalName = hospitalName;
        
        // Update password if provided
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        
        // Save updated user
        await user.save();
        
        // Return updated user data without password
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            hospitalName: user.hospitalName
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { userType, id, password } = req.body;
        
        // Validate input
        if (!userType || !id || !password) {
            return res.status(400).json({ 
                message: 'Please provide user type, ID and password',
                field: 'all'
            });
        }
        
        // Find user by userType and id
        const user = await User.findOne({ userType, id });
        if (!user) {
            console.log('User not found:', { userType, id });
            return res.status(401).json({ 
                message: 'Invalid credentials',
                field: 'id'
            });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Password mismatch:', { userType, id });
            return res.status(401).json({ 
                message: 'Invalid credentials',
                field: 'password'
            });
        }
        
        // Check if user is approved
        if (user.approvalStatus !== 'approved') {
            console.log('Account not approved:', { userType, id });
            return res.status(403).json({ 
                message: 'Account not approved',
                field: 'approval',
                approvalStatus: user.approvalStatus
            });
        }

        // Ensure superadmin flag is set correctly
        if (user.id === 'superadmin' && !user.isSuperAdmin) {
            user.isSuperAdmin = true;
            await user.save();
            console.log('Updated superadmin flag for user:', user.id);
        }

        // Create JWT token
        const token = jwt.sign(
            { id: user._id, userType: user.userType, isSuperAdmin: user.isSuperAdmin },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('Login successful for user:', {
            id: user.id,
            userType: user.userType,
            isSuperAdmin: user.isSuperAdmin
        });
        
        res.json({
            token,
            user: {
                id: user._id,
                userType: user.userType,
                name: user.name,
                email: user.email,
                isSuperAdmin: user.isSuperAdmin
            },
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Register route
router.post('/register', async (req, res) => {
    try {
        const { userType, id, password, name, email, phone } = req.body;
        
        // Validate input
        if (!userType || !id || !password || !name || !email || !phone) {
            return res.status(400).json({ 
                message: 'All fields are required',
                field: 'all'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { userType, id },
                { email }
            ]
        });
        
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ 
                    message: 'Email already in use',
                    field: 'email'
                });
            } else {
                return res.status(400).json({ 
                    message: 'ID already in use for this user type',
                    field: 'id'
                });
            }
        }
        
        // Create new user
        const newUser = new User({
            userType,
            id,
            password,
            name,
            email,
            phone,
            approved: false,
            approvalStatus: 'pending'
        });
        
        // Save user to database
        await newUser.save();
        
        res.status(201).json({
            message: 'Registration successful. Please wait for approval.',
            user: {
                id: newUser._id,
                userType: newUser.userType,
                name: newUser.name,
                email: newUser.email,
                approvalStatus: newUser.approvalStatus
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Special route to fix superadmin status
router.post('/fix-superadmin', async (req, res) => {
    try {
        const superAdmin = await User.findOne({ id: 'superadmin' });
        
        if (!superAdmin) {
            return res.status(404).json({ message: 'Superadmin user not found' });
        }
        
        superAdmin.isSuperAdmin = true;
        superAdmin.approved = true;
        superAdmin.approvalStatus = 'approved';
        await superAdmin.save();
        
        res.json({ 
            message: 'Superadmin status fixed successfully',
            user: {
                id: superAdmin.id,
                name: superAdmin.name,
                isSuperAdmin: superAdmin.isSuperAdmin
            }
        });
    } catch (error) {
        console.error('Error fixing superadmin:', error);
        res.status(500).json({ message: 'Error fixing superadmin status' });
    }
});

// Admin routes
router.get('/admin/users', verifySuperAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
});

router.post('/admin/approve/:userId', verifyAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.approved = true;
        user.approvalStatus = 'approved';
        user.approvedBy = req.user.id;
        user.approvalDate = new Date();
        await user.save();
        
        res.json({ message: 'User approved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error approving user' });
    }
});

router.post('/admin/reject/:userId', verifyAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.approved = false;
        user.approvalStatus = 'rejected';
        user.approvedBy = req.user.id;
        user.approvalDate = new Date();
        await user.save();
        
        res.json({ message: 'User rejected successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting user' });
    }
});

router.get('/admin/dashboard', verifySuperAdmin, async (req, res) => {
    try {
        const pendingUsers = await User.find({ approvalStatus: 'pending' })
            .select('-password')
            .sort({ createdAt: -1 });
        res.json({ pendingUsers });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending users' });
    }
});

module.exports = router;