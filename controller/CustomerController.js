const User = require("../model/UserModel");
const bcrypt = require("bcryptjs");
const { deleteImageFile } = require("../config/Helper");
const { default: mongoose } = require("mongoose");

const CustomerController = {
    // Get all customers with search, filters, and pagination
    getCustomers: async (req, res) => {
        try {
            const { search, page = 1, limit = 10, status = "all" } = req.query;
            const filter = { role: 3 }; // Only fetch customers (role: 3)

            // Search by name, email, or mobile
            if (search && search.trim() !== "") {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { mobile: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            // Filter by status
            if (status && status.trim() !== "" && status.trim() !== "all") {
                if (status === "deleted") {
                    filter.isDeleted = true;
                } else if (status === "inactive") {
                    filter.isActive = false;
                    filter.isDeleted = { $ne: true };
                } else if (status === "active") {
                    filter.isActive = true;
                    filter.isDeleted = { $ne: true };
                }
            } else {
                // By default, exclude deleted users unless specifically requested
                if (!filter.isDeleted) {
                    filter.isDeleted = { $ne: true };
                }
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [users, total] = await Promise.all([
                User.find(filter)
                    .select('-password')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                User.countDocuments(filter)
            ]);

            res.status(200).json({
                status: true,
                data: users,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });

        } catch (error) {
            console.error("Get customers error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get single customer by ID
    getCustomerById: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid customer ID format"
                });
            }

            const customer = await User.findOne({ _id: id, role: 3 }).select("-password");

            if (!customer) {
                return res.status(404).json({
                    status: false,
                    message: "Customer not found"
                });
            }

            res.status(200).json({
                status: true,
                data: customer
            });

        } catch (error) {
            console.error("Get customer by ID error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Create new customer
    createCustomer: async (req, res) => {
        try {
            const { name, email, mobile, password, isActive } = req.body;

            // Validation
            if (!name || !email || !mobile || !password) {
                // If validation fails, delete uploaded image
                if (req.file) {
                    await deleteImageFile('customers', req.file.filename);
                }
                return res.status(400).json({
                    status: false,
                    message: "Please provide all required fields: name, email, mobile, password"
                });
            }

            // Check if customer already exists
            const existingCustomer = await User.findOne({
                $or: [{ email }, { mobile }]
            });

            if (existingCustomer) {
                // If customer exists, delete uploaded image
                if (req.file) {
                    await deleteImageFile('customers', req.file.filename);
                }
                return res.status(400).json({
                    status: false,
                    message: "Customer with this email or mobile already exists"
                });
            }

            // Handle image upload
            let image;
            if (req.file) {
                image = req.file.filename;
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new customer
            const newCustomer = new User({
                name,
                email,
                mobile,
                password: hashedPassword,
                role: 3, // Customer role
                image,
                isActive: isActive !== undefined ? isActive === 'true' : true
            });

            await newCustomer.save();

            // Remove password from response
            const customerResponse = newCustomer.toObject();
            delete customerResponse.password;

            res.status(201).json({
                status: true,
                message: "Customer created successfully",
                data: customerResponse
            });

        } catch (error) {
            // If error occurs, delete uploaded image
            if (req.file) {
                await deleteImageFile('customers', req.file.filename);
            }
            console.error("Create customer error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update customer
    updateCustomer: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                // If invalid ID, delete uploaded image
                if (req.file) {
                    await deleteImageFile('customers', req.file.filename);
                }
                return res.status(400).json({
                    status: false,
                    message: "Invalid customer ID format"
                });
            }

            // Remove fields that shouldn't be updated directly
            delete updates.password;
            delete updates.role;
            delete updates._id;

            // Check if customer exists
            const customer = await User.findOne({ _id: id, role: 3 });
            if (!customer) {
                // If customer not found, delete uploaded image
                if (req.file) {
                    await deleteImageFile('customers', req.file.filename);
                }
                return res.status(404).json({
                    status: false,
                    message: "Customer not found"
                });
            }

            // Check for duplicate email/mobile if they're being updated
            if (updates.email || updates.mobile) {
                const duplicateCheck = await User.findOne({
                    _id: { $ne: id },
                    role: 3,
                    $or: [
                        updates.email ? { email: updates.email } : null,
                        updates.mobile ? { mobile: updates.mobile } : null
                    ].filter(condition => condition !== null)
                });

                if (duplicateCheck) {
                    // If duplicate found, delete uploaded image
                    if (req.file) {
                        await deleteImageFile('customers', req.file.filename);
                    }
                    return res.status(400).json({
                        status: false,
                        message: "Email or mobile already in use by another customer"
                    });
                }
            }

            // Handle image upload
            if (req.file) {
                // Delete old image if exists
                if (customer.image) {
                    await deleteImageFile('customers', customer.image);
                }
                updates.image = req.file.filename;
            }

            // Handle image removal if requested
            if (updates.removeImage === 'true') {
                if (customer.image) {
                    await deleteImageFile('customers', customer.image);
                    updates.image = null;
                }
                delete updates.removeImage;
            }

            // Convert isActive to boolean if provided
            if (updates.isActive !== undefined) {
                updates.isActive = updates.isActive === 'true' || updates.isActive === true;
            }

            // Update customer
            const updatedCustomer = await User.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true, runValidators: true }
            ).select("-password");

            res.json({
                status: true,
                message: "Customer updated successfully",
                data: updatedCustomer
            });

        } catch (error) {
            // If error occurs, delete uploaded image
            if (req.file) {
                await deleteImageFile('customers', req.file.filename);
            }
            console.error("Update customer error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update customer status (activate/deactivate)
    updateCustomerStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid customer ID format"
                });
            }

            if (isActive === undefined) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide isActive status"
                });
            }

            // Check if customer exists
            const customer = await User.findOne({ _id: id, role: 3 });
            if (!customer) {
                return res.status(404).json({
                    status: false,
                    message: "Customer not found"
                });
            }

            // Update status
            const updatedCustomer = await User.findByIdAndUpdate(
                id,
                { $set: { isActive: isActive === 'true' || isActive === true } },
                { new: true }
            ).select("-password");

            res.json({
                status: true,
                message: `Customer ${updatedCustomer.isActive ? "activated" : "deactivated"} successfully`,
                data: updatedCustomer
            });

        } catch (error) {
            console.error("Update customer status error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Soft delete customer
    softDeleteCustomer: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid customer ID format"
                });
            }

            // Check if customer exists
            const customer = await User.findOne({ _id: id, role: 3 });
            if (!customer) {
                return res.status(404).json({
                    status: false,
                    message: "Customer not found"
                });
            }

            // Soft delete - set isDeleted to true and isActive to false
            await User.findByIdAndUpdate(id, {
                $set: {
                    isDeleted: true,
                    isActive: false
                }
            });

            res.json({
                status: true,
                message: "Customer deleted successfully"
            });

        } catch (error) {
            console.error("Soft delete customer error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Restore deleted customer
    restoreCustomer: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid customer ID format"
                });
            }

            // Check if customer exists
            const customer = await User.findOne({ _id: id, role: 3 });
            if (!customer) {
                return res.status(404).json({
                    status: false,
                    message: "Customer not found"
                });
            }

            // Restore customer
            await User.findByIdAndUpdate(id, {
                $set: {
                    isDeleted: false,
                    isActive: true
                }
            });

            res.json({
                status: true,
                message: "Customer restored successfully"
            });

        } catch (error) {
            console.error("Restore customer error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Permanently delete customer
    permanentDeleteCustomer: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid customer ID format"
                });
            }

            // Check if customer exists
            const customer = await User.findOne({ _id: id, role: 3 });
            if (!customer) {
                return res.status(404).json({
                    status: false,
                    message: "Customer not found"
                });
            }

            // Delete associated image if exists
            if (customer.image) {
                await deleteImageFile('customers', customer.image);
            }

            // Permanent delete
            await User.findByIdAndDelete(id);

            res.json({
                status: true,
                message: "Customer permanently deleted"
            });

        } catch (error) {
            console.error("Permanent delete customer error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get customer statistics
    getCustomerStats: async (req, res) => {
        try {
            const totalCustomers = await User.countDocuments({ role: 3, isDeleted: { $ne: true } });
            const activeCustomers = await User.countDocuments({
                role: 3,
                isActive: true,
                isDeleted: { $ne: true }
            });
            const inactiveCustomers = await User.countDocuments({
                role: 3,
                isActive: false,
                isDeleted: { $ne: true }
            });
            const deletedCustomers = await User.countDocuments({ role: 3, isDeleted: true });

            // Customers joined this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const newThisMonth = await User.countDocuments({
                role: 3,
                createdAt: { $gte: startOfMonth },
                isDeleted: { $ne: true }
            });

            res.json({
                status: true,
                data: {
                    total: totalCustomers,
                    active: activeCustomers,
                    inactive: inactiveCustomers,
                    deleted: deletedCustomers,
                    newThisMonth
                }
            });

        } catch (error) {
            console.error("Get customer stats error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = CustomerController;