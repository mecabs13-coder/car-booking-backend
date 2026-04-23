const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/UserModel");

const userController = {
    TestAPI: async (req, res) => {
        try {
            const users = await User.find().select('name');
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    
    adminLogin: async (req, res) => {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide email and password"
                });
            }

            // Check if user exists and is admin (role: 1)
            const admin = await User.findOne({
                email: email,
                role: 1,  // 1 for Admin
                isActive: true
            });

            if (!admin) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials or you're not authorized as admin"
                });
            }

            // Compare password
            const isPasswordValid = await bcrypt.compare(password, admin.password);

            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: admin._id,
                    email: admin.email,
                    role: admin.role,
                    name: admin.name
                },
                process.env.JWT_KEY, // Use environment variable in production
                { expiresIn: "7d" }
            );

            // Remove password from response
            const adminResponse = admin.toObject();
            delete adminResponse.password;

            res.status(200).json({
                success: true,
                message: "Admin login successful",
                token,
                userData: adminResponse
            });

        } catch (error) {
            console.error("Admin login error:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    driverLogin: async (req, res) => {
        try {
            const { email, mobile, password } = req.body;

            // Validation - can login with either email or mobile
            if ((!email && !mobile) || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide either email or mobile, and password"
                });
            }

            // Build query based on provided credentials
            let query = {
                role: 2,  // 2 for Driver
                isActive: true
            };

            if (email) {
                query.email = email;
            } else if (mobile) {
                query.mobile = mobile;
            }

            // Check if driver exists
            const driver = await User.findOne(query);

            if (!driver) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials or you're not authorized as driver"
                });
            }

            // Compare password
            const isPasswordValid = await bcrypt.compare(password, driver.password);

            if (!isPasswordValid) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: driver._id,
                    email: driver.email,
                    mobile: driver.mobile,
                    role: driver.role,
                    name: driver.name
                },
                process.env.JWT_KEY, // Use environment variable in production
                { expiresIn: "7d" }
            );

            // Remove password from response
            const driverResponse = driver.toObject();
            delete driverResponse.password;

            res.status(200).json({
                success: true,
                message: "Driver login successful",
                token,
                userData: driverResponse
            });

        } catch (error) {
            console.error("Driver login error:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = userController;