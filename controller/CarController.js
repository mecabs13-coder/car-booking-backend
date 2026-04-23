const { default: mongoose } = require("mongoose");
const { deleteImageFile } = require("../config/Helper");
const Car = require("../model/CarModel");
const User = require("../model/UserModel");
const Booking = require("../model/BookingModel");

const CarController = {
    // Get all cars with pagination, filters, and search
    getAllCars: async (req, res) => {
        try {
            const {
                search = "",
                page = 1,
                limit = 10,
                company,
                model,
                fuelType,
                status,
                driverId,
                sortBy = "createdAt",
                sortOrder = "desc"
            } = req.query;

            // Build search and filter query
            let query = {};

            // Search by name (case-insensitive)
            if (search) {
                query.name = { $regex: search, $options: "i" };
            }

            // Apply filters
            if (company) {
                query.company = company;
            }
            if (model) {
                query.model = { $regex: model, $options: "i" };
            }
            if (fuelType) {
                query.fuelType = fuelType;
            }
            // if (isActive !== undefined) {
            //     query.isActive = isActive === 'true';
            // }
            if (status && status.trim() !== "" && status.trim() !== "all") {
                if (status === "deleted") {
                    query.isDeleted = true;
                } else if (status === "inactive") {
                    query.isActive = false;
                    query.isDeleted = { $ne: true };
                } else if (status === "active") {
                    query.isActive = true;
                    query.isDeleted = { $ne: true };
                }
            } else {
                // By default, exclude deleted users unless specifically requested
                if (!query.isDeleted) {
                    query.isDeleted = { $ne: true };
                }
            }
            // if (driverId) {
            //     if (driverId === "unassigned") {
            //         query.driverId = null
            //     } else {
            //         query.driverId = driverId;
            //     }
            // }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute queries with population
            const cars = await Car.find(query)
                // .populate("driverId", "name") // Populate driver details
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Car.countDocuments(query);

            res.json({
                status: true,
                data: cars,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                },
                filters: {
                    company,
                    model,
                    fuelType,
                    status,
                    driverId
                }
            });

        } catch (error) {
            console.error("Get all cars error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get car by ID
    getCarById: async (req, res) => {
        try {
            const { id } = req.params;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            const car = await Car.findById(id)
            // .populate("driverId", "name email mobile image documentNumber isActive");

            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            res.json({
                status: true,
                data: car
            });

        } catch (error) {
            console.error("Get car by ID error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Create new car
    createCar: async (req, res) => {
        try {
            const {
                name,
                company,
                model,
                fuelType,
                personSeating,
                // pricePerHour,
                // driverId,
                carNumber,
                currentOdometer,
                isActive
            } = req.body;

            // Validation
            if (!name /* || !pricePerHour */) {
                // If validation fails, delete uploaded image
                if (req.file) {
                    await deleteImageFile('cars', req.file.filename);
                }

                return res.status(400).json({
                    status: false,
                    message: "Please provide all required fields: name"
                });
            }

            // // Validate driverId if provided
            // if (driverId) {
            //     const car = await Car.findOne({ driverId });
            //     if (car) {
            //         return res.status(400).json({ status: false, message: "selected driver already assign to another car" });
            //     }
            //     const driver = await User.findOne({ _id: driverId, role: 2 });
            //     if (!driver) {
            //         // If driver not found, delete uploaded image
            //         if (req.file) {
            //             await deleteImageFile('cars', req.file.filename);
            //         }
            //         return res.status(400).json({ status: false, message: "Invalid driver ID or driver does not exist" });
            //     }
            // }

            // Handle image upload
            let image;
            if (req.file) {
                image = req.file.filename;
            }

            // Create new car
            const newCar = new Car({
                name,
                image,
                company,
                carNumber,
                model,
                fuelType,
                personSeating: personSeating ? parseInt(personSeating) : undefined,
                // pricePerHour: parseFloat(pricePerHour),
                // driverId: driverId || null,
                currentOdometer: currentOdometer ? parseInt(currentOdometer) : 0,
                isActive: isActive !== undefined ? isActive === 'true' : true
            });

            await newCar.save();

            // Populate driver details in response
            await newCar.populate("driverId", "name email mobile image");

            res.status(201).json({
                status: true,
                message: "Car created successfully",
                data: newCar
            });

        } catch (error) {
            // If error occurs, delete uploaded image
            if (req.file) {
                await deleteImageFile('cars', req.file.filename);
            }

            console.error("Create car error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update car
    updateCar: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                // If invalid ID, delete uploaded image
                if (req.file) {
                    await deleteImageFile('cars', req.file.filename);
                }

                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            // Check if car exists
            const car = await Car.findById(id);
            if (!car) {
                // If car not found, delete uploaded image
                if (req.file) {
                    await deleteImageFile('cars', req.file.filename);
                }

                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // // Validate driverId if provided
            // if (updates.driverId) {
            //     if (updates.driverId != car.driverId) {
            //         const car = await Car.findOne({ driverId: updates.driverId });
            //         if (car) {
            //             return res.status(400).json({ status: false, message: "selected driver already assign to another car" });
            //         }
            //     }
            //     const driver = await User.findOne({ _id: updates.driverId, role: 2 });
            //     if (!driver) {
            //         // If driver not found, delete uploaded image
            //         if (req.file) {
            //             await deleteImageFile('cars', req.file.filename);
            //         }

            //         return res.status(400).json({
            //             status: false,
            //             message: "Invalid driver ID or driver does not exist"
            //         });
            //     }
            // }

            // Handle image upload
            if (req.file) {
                // Delete old image if exists
                if (car.image) {
                    await deleteImageFile('cars', car.image);
                }
                updates.image = req.file.filename;
            }

            // Handle image removal if requested
            if (updates.removeImage === 'true') {
                if (car.image) {
                    await deleteImageFile('cars', car.image);
                    updates.image = null;
                }
                delete updates.removeImage;
            }

            // Convert numeric fields
            if (updates.personSeating) {
                updates.personSeating = parseInt(updates.personSeating);
            }
            // if (updates.pricePerHour) {
            //     updates.pricePerHour = parseFloat(updates.pricePerHour);
            // }
            if (updates.currentOdometer) {
                updates.currentOdometer = parseInt(updates.currentOdometer);
            }
            if (updates.isActive !== undefined) {
                updates.isActive = updates.isActive === 'true';
            }

            // Remove fields that shouldn't be updated directly
            delete updates._id;

            // Update car
            const updatedCar = await Car.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true, runValidators: true }
            );

            res.json({
                status: true,
                message: "Car updated successfully",
                data: updatedCar
            });

        } catch (error) {
            // If error occurs, delete uploaded image
            if (req.file) {
                await deleteImageFile('cars', req.file.filename);
            }

            console.error("Update car error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update car status (activate/deactivate)
    carStatusUpdate: async (req, res) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            if (isActive === undefined) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide isActive status"
                });
            }

            // Check if car exists
            const car = await Car.findById(id);
            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // Update status
            const updatedCar = await Car.findByIdAndUpdate(
                id,
                { $set: { isActive: isActive === 'true' || isActive === true } },
                { new: true }
            );
            // .populate("driverId", "name email mobile image");

            res.json({
                status: true,
                message: `Car ${updatedCar.isActive ? "activated" : "deactivated"} successfully`,
                data: updatedCar
            });

        } catch (error) {
            console.error("Update car status error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete car (soft delete or permanent delete)
    deleteCar: async (req, res) => {
        try {
            const { id } = req.params;
            const { permanent = false } = req.query;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            // Check if car exists
            const car = await Car.findById(id);
            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            if (permanent === 'true') {
                // Delete associated image before permanent delete
                if (car.image) {
                    await deleteImageFile('cars', car.image);
                }

                // Permanent delete
                await Car.findByIdAndDelete(id);
            } else {
                // Soft delete - set isActive to false
                await Car.findByIdAndUpdate(id, { $set: { isDeleted: true } });
            }

            res.json({
                status: true,
                message: permanent === 'true' ? "Car permanently deleted" : "Car deactivated successfully"
            });

        } catch (error) {
            console.error("Delete car error:", error);
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
                    message: "Invalid Car ID format"
                });
            }

            // Check if Car exists
            const car = await Car.findOne({ _id: id });
            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // Restore car
            await Car.findByIdAndUpdate(id, {
                $set: {
                    isDeleted: false,
                    isActive: true
                }
            });

            res.json({
                status: true,
                message: "Car restored successfully"
            });

        } catch (error) {
            console.error("Restore car error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get cars by driver
    getCarsByDriver: async (req, res) => {
        try {
            const { driverId } = req.params;
            const { page = 1, limit = 10, isActive } = req.query;

            // Validate driverId
            if (!mongoose.Types.ObjectId.isValid(driverId)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid driver ID format"
                });
            }

            // Check if driver exists
            const driver = await User.findOne({ _id: driverId, role: 2 });
            if (!driver) {
                return res.status(404).json({
                    status: false,
                    message: "Driver not found"
                });
            }

            // Build query
            let query = { driverId };
            if (isActive !== undefined) {
                query.isActive = isActive === 'true';
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get cars
            const cars = await Car.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Car.countDocuments(query);

            res.json({
                status: true,
                data: cars,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });

        } catch (error) {
            console.error("Get cars by driver error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // // Get cars by driver
    // getCarsNameByDriver: async (req, res) => {
    //     try {
    //         const { driverId } = req.params;

    //         // Validate driverId
    //         if (!mongoose.Types.ObjectId.isValid(driverId)) {
    //             return res.status(400).json({
    //                 status: false,
    //                 message: "Invalid driver ID format"
    //             });
    //         }

    //         // Check if driver exists
    //         const driver = await User.findOne({ _id: driverId, role: 2 });
    //         if (!driver) {
    //             return res.status(404).json({ status: false, message: "Driver not found" });
    //         }

    //         // Build query
    //         let query = { driverId, isActive: true };

    //         // Get cars
    //         const cars = await Car.find(query).select('name').sort({ createdAt: -1 })
    //         res.json({
    //             status: true,
    //             data: cars,
    //         });

    //     } catch (error) {
    //         console.error("Get cars by driver error:", error);
    //         res.status(500).json({
    //             status: false,
    //             message: "Internal server error",
    //             error: error.message
    //         });
    //     }
    // },

    getCars: async (req, res) => {
        try {
            const {
                company,
                model,
                fuelType,
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
                .select("carId");

            const bookedCarIds = overlappingBookings.map(
                booking => booking.carId
            );

            // 🔎 2️⃣ Build car filter
            let carQuery = {
                isActive: true,
                isDeleted: false,
                _id: { $nin: bookedCarIds }
            };

            if (company) {
                carQuery.carCompany = { $regex: company, $options: "i" };
            }

            if (model) {
                carQuery.carModel = { $regex: model, $options: "i" };
            }

            if (fuelType) {
                carQuery.fuelType = fuelType;
            }

            const cars = await Car.find(carQuery)/* .populate("driverId") */;

            res.json({
                success: true,
                total: cars.length,
                data: cars
            });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = CarController;