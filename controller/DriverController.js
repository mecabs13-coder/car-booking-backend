const bcrypt = require("bcryptjs");
const User = require("../model/UserModel");
const { deleteImageFile } = require("../config/Helper");
const Booking = require("../model/BookingModel");

const DriverController = {
    // Get all drivers with search and pagination
    getDrivers: async (req, res) => {
        try {
            const {
                search = "",
                page = 1,
                limit = 10,
                sortBy = "createdAt",
                sortOrder = "desc"
            } = req.query;

            // Build search query
            let query = { role: 2 }; // Only fetch drivers (role: 2)

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { mobile: { $regex: search, $options: "i" } },
                    { documentNumber: { $regex: search, $options: "i" } }
                ];
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute queries
            const drivers = await User.find(query)
                .select("-password") // Exclude password from results
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));

            const total = await User.countDocuments(query);

            res.json({
                status: true,
                data: drivers,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });

        } catch (error) {
            console.error("Get drivers error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    createDriver: async (req, res) => {
        try {
            const {
                name,
                email,
                mobile,
                password,
                documentNumber,
                isActive
            } = req.body;

            // Validation
            if (!name || !email || !mobile || !password || !documentNumber) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide all required fields: name, email, mobile, password, documentNumber"
                });
            }

            // Check if driver already exists
            const existingDriver = await User.findOne({
                $or: [{ email }, { mobile }, { documentNumber }]
            });

            if (existingDriver) {
                // If driver exists, delete any uploaded files
                if (req.files) {
                    if (req.files.image) {
                        await deleteImageFile('drivers', req.files.image[0].filename);
                    }
                    if (req.files.documentImage) {
                        await deleteImageFile('drivers', req.files.documentImage[0].filename);
                    }
                }

                return res.status(400).json({
                    status: false,
                    message: "Driver with this email, mobile, or document number already exists"
                });
            }

            let image;
            let documentImage;

            if (req.files && req.files.image) {
                image = req.files.image[0].filename;
            }
            if (req.files && req.files.documentImage) {
                documentImage = req.files.documentImage[0].filename;
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new driver
            const newDriver = new User({
                name,
                email,
                mobile,
                password: hashedPassword,
                role: 2, // Driver role
                image,
                documentImage,
                documentNumber,
                isActive: isActive !== undefined ? isActive : true
            });

            await newDriver.save();

            // Remove password from response
            const driverResponse = newDriver.toObject();
            delete driverResponse.password;

            res.status(201).json({
                status: true,
                message: "Driver created successfully",
                data: driverResponse
            });

        } catch (error) {
            // If error occurs, delete any uploaded files
            if (req.files) {
                if (req.files.image) {
                    await deleteImageFile('drivers', req.files.image[0].filename);
                }
                if (req.files.documentImage) {
                    await deleteImageFile('drivers', req.files.documentImage[0].filename);
                }
            }

            console.error("Create driver error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get single driver by ID
    getDriverById: async (req, res) => {
        try {
            const { id } = req.params;
            const driver = await User.findOne({ _id: id, role: 2 }).select("-password");

            if (!driver) {
                return res.status(404).json({ status: false, message: "Driver not found" });
            }

            res.json({ status: true, data: driver });

        } catch (error) {
            console.error("Get driver by ID error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Edit/Update driver
    updateDriver: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates.password;
            delete updates.role;
            delete updates._id;

            // Check if driver exists
            const driver = await User.findOne({ _id: id, role: 2 });
            if (!driver) {
                return res.status(404).json({
                    status: false,
                    message: "Driver not found"
                });
            }

            // Check for duplicate email/mobile/documentNumber if they're being updated
            if (updates.email || updates.mobile || updates.documentNumber) {
                const duplicateCheck = await User.findOne({
                    _id: { $ne: id },
                    role: 2,
                    $or: [
                        updates.email ? { email: updates.email } : null,
                        updates.mobile ? { mobile: updates.mobile } : null,
                        updates.documentNumber ? { documentNumber: updates.documentNumber } : null
                    ].filter(condition => condition !== null)
                });

                if (duplicateCheck) {
                    return res.status(400).json({
                        status: false,
                        message: "Email, mobile, or document number already in use by another driver"
                    });
                }
            }

            // Handle image uploads
            let imageUpdate = {};

            // Handle profile image
            if (req.files && req.files.image) {
                // Delete old image if exists
                if (driver.image) {
                    await deleteImageFile('drivers', driver.image);
                }
                imageUpdate.image = req.files.image[0].filename;
            }

            // Handle document image
            if (req.files && req.files.documentImage) {
                // Delete old document image if exists
                if (driver.documentImage) {
                    await deleteImageFile('drivers', driver.documentImage);
                }
                imageUpdate.documentImage = req.files.documentImage[0].filename;
            }

            // Handle image removal if requested (optional)
            if (updates.removeImage === 'true') {
                if (driver.image) {
                    await deleteImageFile('drivers', driver.image);
                    imageUpdate.image = null;
                }
                delete updates.removeImage;
            }

            if (updates.removeDocumentImage === 'true') {
                if (driver.documentImage) {
                    await deleteImageFile('drivers', driver.documentImage);
                    imageUpdate.documentImage = null;
                }
                delete updates.removeDocumentImage;
            }

            // Combine text updates with image updates
            const finalUpdates = {
                ...updates,
                ...imageUpdate
            };

            // Update driver
            const updatedDriver = await User.findByIdAndUpdate(
                id,
                { $set: finalUpdates },
                { new: true, runValidators: true }
            ).select("-password");

            res.json({
                status: true,
                message: "Driver updated successfully",
                data: updatedDriver
            });

        } catch (error) {
            console.error("Edit driver error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update driver status (activate/deactivate)
    updateDriverStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;

            if (isActive === undefined) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide isActive status"
                });
            }

            // Check if driver exists
            const driver = await User.findOne({
                _id: id,
                role: 2
            });

            if (!driver) {
                return res.status(404).json({
                    status: false,
                    message: "Driver not found"
                });
            }

            // Update status
            const updatedDriver = await User.findByIdAndUpdate(
                id,
                { $set: { isActive } },
                { new: true }
            ).select("-password");

            res.json({
                status: true,
                message: `Driver ${isActive ? "activated" : "deactivated"} successfully`,
                data: updatedDriver
            });

        } catch (error) {
            console.error("Update driver status error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete driver (soft delete or permanent delete)
    deleteDriver: async (req, res) => {
        try {
            const { id } = req.params;
            const { permanent = false } = req.query; // Query param for permanent delete

            // Check if driver exists
            const driver = await User.findOne({
                _id: id,
                role: 2
            });

            if (!driver) {
                return res.status(404).json({
                    status: false,
                    message: "Driver not found"
                });
            }

            if (permanent === 'true') {
                // Permanent delete
                await User.findByIdAndDelete(id);
            } else {
                // Soft delete - set isActive to false
                await User.findByIdAndUpdate(id, { $set: { isActive: false } });
            }

            res.json({
                status: true,
                message: permanent === 'true' ? "Driver permanently deleted" : "Driver deactivated successfully"
            });

        } catch (error) {
            console.error("Delete driver error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update driver password (separate function)
    updateDriverPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide current password and new password"
                });
            }

            // Find driver
            const driver = await User.findOne({
                _id: id,
                role: 2
            });

            if (!driver) {
                return res.status(404).json({
                    status: false,
                    message: "Driver not found"
                });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, driver.password);

            if (!isPasswordValid) {
                return res.status(401).json({
                    status: false,
                    message: "Current password is incorrect"
                });
            }

            // Hash and update new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            driver.password = hashedPassword;
            await driver.save();

            res.json({
                status: true,
                message: "Password updated successfully"
            });

        } catch (error) {
            console.error("Update password error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    getAvailableDrivers: async (req, res) => {
        try {
            const {
                fromDate,
                toDate,
                bookingId
            } = req.query;

            if (!fromDate || !toDate) {
                return res.status(400).json({
                    message: "fromDate and toDate are required"
                });
            }

            const from = new Date(fromDate);
            const to = new Date(toDate);

            // 🔥 Build overlap filter
            let bookingFilter = {
                status: { $in: ["Booked", "Ongoing"] },
                fromDate: { $lte: to },
                toDate: { $gte: from }
            };

            // ✅ IMPORTANT: Exclude current booking (edit mode)
            if (bookingId) {
                bookingFilter._id = { $ne: bookingId };
            }

            // 🔎 1️⃣ Find overlapping bookings (excluding itself)
            const overlappingBookings = await Booking.find(bookingFilter)
                .select("driverId");

            const bookedDriverIds = overlappingBookings.map(
                booking => booking.driverId
            );

            // 🔎 2️⃣ Build car filter
            let driverQuery = {
                role: 2,
                isActive: true,
                _id: { $nin: bookedDriverIds }
            };

            // if (company) {
            //     driverQuery.carCompany = { $regex: company, $options: "i" };
            // }

            // if (model) {
            //     driverQuery.carModel = { $regex: model, $options: "i" };
            // }

            // if (fuelType) {
            //     driverQuery.fuelType = fuelType;
            // }

            const drivers = await User.find(driverQuery)/* .populate("driverId") */;

            return res.json({
                success: true,
                total: drivers.length,
                data: drivers
            });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = DriverController;