const { default: mongoose } = require("mongoose");
const { deleteImageFile } = require("../config/Helper");
const Booking = require("../model/BookingModel");
const Car = require("../model/CarModel");
const FuelLog = require("../model/FuelLogModel");

const FuelLogController = {
    // Create fuel log
    createFuelLog: async (req, res) => {
        try {
            const {
                carId,
                bookingId,
                odometerReading,
                fuelAmountLiter,
                fuelCost,
                fuelDate
            } = req.body;

            // Validation
            if (!carId || !odometerReading || !fuelAmountLiter) {
                // If validation fails, delete uploaded images
                if (req.files) {
                    if (req.files.odometerImage) {
                        await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                    }
                    if (req.files.fuelBillImage) {
                        await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                    }
                }

                return res.status(400).json({
                    status: false,
                    message: "Please provide carId, odometerReading, and fuelAmountLiter"
                });
            }

            // Check if car exists
            const car = await Car.findById(carId);
            if (!car) {
                // If car not found, delete uploaded images
                if (req.files) {
                    if (req.files.odometerImage) {
                        await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                    }
                    if (req.files.fuelBillImage) {
                        await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                    }
                }

                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // Validate bookingId if provided
            if (bookingId) {
                const booking = await Booking.findById(bookingId);
                if (!booking) {
                    // If booking not found, delete uploaded images
                    if (req.files) {
                        if (req.files.odometerImage) {
                            await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                        }
                        if (req.files.fuelBillImage) {
                            await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                        }
                    }

                    return res.status(404).json({
                        status: false,
                        message: "Booking not found"
                    });
                }
            }

            // Check if images are provided
            if (!req.files || !req.files.odometerImage || !req.files.fuelBillImage) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide odometerImage and fuelBillImage"
                });
            }

            // Create fuel log
            const fuelLog = new FuelLog({
                carId,
                bookingId: bookingId || null,
                odometerImage: req.files.odometerImage[0].filename,
                odometerReading: parseFloat(odometerReading),
                fuelBillImage: req.files.fuelBillImage[0].filename,
                fuelAmountLiter: parseFloat(fuelAmountLiter),
                fuelCost: fuelCost ? parseFloat(fuelCost) : undefined,
                fuelDate: new Date()
            });

            await fuelLog.save();

            // Populate references in response
            await fuelLog.populate([
                { path: "carId", select: "name company model image" },
                { path: "bookingId", select: "bookingNumber startDate endDate" }
            ]);

            res.status(201).json({
                status: true,
                message: "Fuel log created successfully",
                data: fuelLog
            });

        } catch (error) {
            // If error occurs, delete uploaded images
            if (req.files) {
                if (req.files.odometerImage) {
                    await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                }
                if (req.files.fuelBillImage) {
                    await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                }
            }

            console.error("Create fuel log error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all fuel logs with pagination and filters
    getAllFuelLogs: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                carId,
                bookingId,
                startDate,
                search,
                endDate,
                minOdometer,
                maxOdometer,
                minFuelAmount,
                maxFuelAmount,
                sortBy = "fuelDate",
                sortOrder = "desc"
            } = req.query;

            // Build query
            let query = {};

            if (carId) {
                query.carId = carId;
            }
            if (bookingId) {
                query.bookingId = bookingId;
            }
            if (req.role === 2) {
                // Get all bookings assigned to this driver
                const driverBookings = await Booking.find(
                    { driverId: req.userId },
                    "_id"
                );

                const bookingIds = driverBookings.map(b => b._id);

                // If no bookings, return empty result early
                if (bookingIds.length === 0) {
                    return res.json({
                        status: true,
                        data: [],
                        pagination: {
                            total: 0,
                            page: parseInt(page),
                            totalPages: 0,
                            limit: parseInt(limit)
                        },
                        statistics: {
                            totalFuelAmount: 0,
                            totalFuelCost: 0,
                            averageFuelCost: 0,
                            totalEntries: 0
                        }
                    });
                }

                // Filter fuel logs by those booking IDs
                query.bookingId = { $in: bookingIds };
            }

            // Date range filters
            if (startDate || endDate) {
                query.fuelDate = {};
                if (startDate) {
                    query.fuelDate.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.fuelDate.$lte = new Date(endDate);
                }
            }

            // Odometer range filters
            if (minOdometer || maxOdometer) {
                query.odometerReading = {};
                if (minOdometer) {
                    query.odometerReading.$gte = parseFloat(minOdometer);
                }
                if (maxOdometer) {
                    query.odometerReading.$lte = parseFloat(maxOdometer);
                }
            }

            // Fuel amount range filters
            if (minFuelAmount || maxFuelAmount) {
                query.fuelAmountLiter = {};
                if (minFuelAmount) {
                    query.fuelAmountLiter.$gte = parseFloat(minFuelAmount);
                }
                if (maxFuelAmount) {
                    query.fuelAmountLiter.$lte = parseFloat(maxFuelAmount);
                }
            }

            // Search functionality (search in customer name, email, car details, locations)
            if (search) {
                const cars = await Car.find({
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { company: { $regex: search, $options: 'i' } },
                        { model: { $regex: search, $options: 'i' } }
                    ]
                }).select('_id');

                const carIds = cars.map(c => c._id);
                const bookings = await Booking.find({
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { company: { $regex: search, $options: 'i' } },
                        { model: { $regex: search, $options: 'i' } },
                        { bookingNumber: { $regex: search, $options: 'i' } }
                    ]
                }).select('_id');

                const bookingIds = bookings.map(c => c._id);

                query.$or = [
                    { carId: { $in: carIds } },
                    { bookingId: { $in: bookingIds } },
                ];
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute queries with population
            const fuelLogs = await FuelLog.find(query)
                .populate("carId", "name company model image")
                .populate("bookingId", "bookingNumber startDate endDate")
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));

            const total = await FuelLog.countDocuments(query);

            // Calculate statistics
            const totalFuelAmount = fuelLogs.reduce((sum, log) => sum + log.fuelAmountLiter, 0);
            const totalFuelCost = fuelLogs.reduce((sum, log) => sum + (log.fuelCost || 0), 0);
            const averageFuelCost = fuelLogs.length > 0 ? totalFuelCost / fuelLogs.length : 0;

            res.json({
                status: true,
                data: fuelLogs,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                },
                statistics: {
                    totalFuelAmount: Math.round(totalFuelAmount * 100) / 100,
                    totalFuelCost: Math.round(totalFuelCost * 100) / 100,
                    averageFuelCost: Math.round(averageFuelCost * 100) / 100,
                    totalEntries: fuelLogs.length
                },
                filters: {
                    carId,
                    bookingId,
                    startDate,
                    endDate,
                    minOdometer,
                    maxOdometer,
                    minFuelAmount,
                    maxFuelAmount
                }
            });

        } catch (error) {
            console.error("Get all fuel logs error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get fuel log by ID
    getFuelLogById: async (req, res) => {
        try {
            const { id } = req.params;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid fuel log ID format"
                });
            }

            const fuelLog = await FuelLog.findById(id)
                .populate("carId", "name company model image currentOdometer")
                .populate("bookingId", "bookingNumber startDate endDate userId driverId")
                .populate({
                    path: "bookingId",
                    populate: [
                        { path: "customerId", select: "name email mobile" },
                        { path: "driverId", select: "name email mobile" }
                    ]
                });

            if (!fuelLog) {
                return res.status(404).json({
                    status: false,
                    message: "Fuel log not found"
                });
            }

            res.json({
                status: true,
                data: fuelLog
            });

        } catch (error) {
            console.error("Get fuel log by ID error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get fuel logs by car ID
    getFuelLogsByCar: async (req, res) => {
        try {
            const { carId } = req.params;
            const { page = 1, limit = 10, startDate, endDate } = req.query;

            // Validate carId
            if (!mongoose.Types.ObjectId.isValid(carId)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            // Check if car exists
            const car = await Car.findById(carId);
            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // Build query
            let query = { carId };

            // Date range filters
            if (startDate || endDate) {
                query.fuelDate = {};
                if (startDate) {
                    query.fuelDate.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.fuelDate.$lte = new Date(endDate);
                }
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get fuel logs
            const fuelLogs = await FuelLog.find(query)
                .populate("bookingId", "bookingNumber startDate endDate")
                .sort({ fuelDate: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await FuelLog.countDocuments(query);

            // Calculate car statistics
            const carStats = await FuelLog.aggregate([
                { $match: { carId: mongoose.Types.ObjectId(carId) } },
                {
                    $group: {
                        _id: null,
                        totalFuelAmount: { $sum: "$fuelAmountLiter" },
                        totalFuelCost: { $sum: "$fuelCost" },
                        avgFuelAmount: { $avg: "$fuelAmountLiter" },
                        avgFuelCost: { $avg: "$fuelCost" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            res.json({
                status: true,
                data: fuelLogs,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                },
                carStats: carStats[0] || {
                    totalFuelAmount: 0,
                    totalFuelCost: 0,
                    avgFuelAmount: 0,
                    avgFuelCost: 0,
                    count: 0
                }
            });

        } catch (error) {
            console.error("Get fuel logs by car error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update fuel log
    updateFuelLog: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                // If invalid ID, delete uploaded images
                if (req.files) {
                    if (req.files.odometerImage) {
                        await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                    }
                    if (req.files.fuelBillImage) {
                        await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                    }
                }

                return res.status(400).json({
                    status: false,
                    message: "Invalid fuel log ID format"
                });
            }

            // Check if fuel log exists
            const fuelLog = await FuelLog.findById(id);
            if (!fuelLog) {
                // If log not found, delete uploaded images
                if (req.files) {
                    if (req.files.odometerImage) {
                        await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                    }
                    if (req.files.fuelBillImage) {
                        await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                    }
                }

                return res.status(404).json({
                    status: false,
                    message: "Fuel log not found"
                });
            }

            // Validate carId if being updated
            if (updates.carId) {
                const car = await Car.findById(updates.carId);
                if (!car) {
                    // If car not found, delete uploaded images
                    if (req.files) {
                        if (req.files.odometerImage) {
                            await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                        }
                        if (req.files.fuelBillImage) {
                            await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                        }
                    }

                    return res.status(404).json({
                        status: false,
                        message: "Car not found"
                    });
                }
            }

            // Validate bookingId if being updated
            if (updates.bookingId) {
                const booking = await Booking.findById(updates.bookingId);
                if (!booking) {
                    // If booking not found, delete uploaded images
                    if (req.files) {
                        if (req.files.odometerImage) {
                            await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                        }
                        if (req.files.fuelBillImage) {
                            await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                        }
                    }

                    return res.status(404).json({
                        status: false,
                        message: "Booking not found"
                    });
                }
            }

            // Handle image uploads
            if (req.files) {
                // Handle odometer image
                if (req.files.odometerImage) {
                    // Delete old odometer image
                    if (fuelLog.odometerImage) {
                        await deleteImageFile('fuel-logs', fuelLog.odometerImage);
                    }
                    updates.odometerImage = req.files.odometerImage[0].filename;
                }

                // Handle fuel bill image
                if (req.files.fuelBillImage) {
                    // Delete old fuel bill image
                    if (fuelLog.fuelBillImage) {
                        await deleteImageFile('fuel-logs', fuelLog.fuelBillImage);
                    }
                    updates.fuelBillImage = req.files.fuelBillImage[0].filename;
                }
            }

            // Handle image removal if requested
            if (updates.removeOdometerImage === 'true') {
                if (fuelLog.odometerImage) {
                    await deleteImageFile('fuel-logs', fuelLog.odometerImage);
                    updates.odometerImage = null;
                }
                delete updates.removeOdometerImage;
            }

            if (updates.removeFuelBillImage === 'true') {
                if (fuelLog.fuelBillImage) {
                    await deleteImageFile('fuel-logs', fuelLog.fuelBillImage);
                    updates.fuelBillImage = null;
                }
                delete updates.removeFuelBillImage;
            }

            // Convert numeric fields
            if (updates.odometerReading) {
                updates.odometerReading = parseFloat(updates.odometerReading);
            }
            if (updates.fuelAmountLiter) {
                updates.fuelAmountLiter = parseFloat(updates.fuelAmountLiter);
            }
            if (updates.fuelCost) {
                updates.fuelCost = parseFloat(updates.fuelCost);
            }
            // if (updates.fuelDate) {
            //     updates.fuelDate = new Date(updates.fuelDate);
            // }

            // Remove fields that shouldn't be updated directly
            delete updates._id;

            // Update fuel log
            const updatedFuelLog = await FuelLog.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true, runValidators: true }
            ).populate("carId", "name company model image")
                .populate("bookingId", "bookingNumber startDate endDate");

            res.json({
                status: true,
                message: "Fuel log updated successfully",
                data: updatedFuelLog
            });

        } catch (error) {
            // If error occurs, delete uploaded images
            if (req.files) {
                if (req.files.odometerImage) {
                    await deleteImageFile('fuel-logs', req.files.odometerImage[0].filename);
                }
                if (req.files.fuelBillImage) {
                    await deleteImageFile('fuel-logs', req.files.fuelBillImage[0].filename);
                }
            }

            console.error("Update fuel log error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete fuel log
    deleteFuelLog: async (req, res) => {
        try {
            const { id } = req.params;
            const { permanent = false } = req.query;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid fuel log ID format"
                });
            }

            // Check if fuel log exists
            const fuelLog = await FuelLog.findById(id);
            if (!fuelLog) {
                return res.status(404).json({
                    status: false,
                    message: "Fuel log not found"
                });
            }

            if (permanent === 'true') {
                // Delete associated images
                if (fuelLog.odometerImage) {
                    await deleteImageFile('fuel-logs', fuelLog.odometerImage);
                }
                if (fuelLog.fuelBillImage) {
                    await deleteImageFile('fuel-logs', fuelLog.fuelBillImage);
                }

                // Permanent delete
                await FuelLog.findByIdAndDelete(id);
            } else {
                // Soft delete - you might want to add an isActive field to schema
                // For now, we'll just return error as soft delete might not be applicable
                return res.status(400).json({
                    status: false,
                    message: "Permanent delete required for fuel logs. Use ?permanent=true"
                });
            }

            res.json({
                status: true,
                message: "Fuel log deleted successfully"
            });

        } catch (error) {
            console.error("Delete fuel log error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get fuel consumption report
    getFuelReport: async (req, res) => {
        try {
            const { startDate, endDate, carId, groupBy = 'day' } = req.query;

            // Build match stage
            let matchStage = {};

            if (startDate || endDate) {
                matchStage.fuelDate = {};
                if (startDate) {
                    matchStage.fuelDate.$gte = new Date(startDate);
                }
                if (endDate) {
                    matchStage.fuelDate.$lte = new Date(endDate);
                }
            }

            if (carId) {
                matchStage.carId = mongoose.Types.ObjectId(carId);
            }

            // Determine date format for grouping
            let dateFormat;
            switch (groupBy) {
                case 'hour':
                    dateFormat = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$fuelDate" } };
                    break;
                case 'day':
                    dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$fuelDate" } };
                    break;
                case 'week':
                    dateFormat = { $dateToString: { format: "%Y-W%V", date: "$fuelDate" } };
                    break;
                case 'month':
                    dateFormat = { $dateToString: { format: "%Y-%m", date: "$fuelDate" } };
                    break;
                case 'year':
                    dateFormat = { $dateToString: { format: "%Y", date: "$fuelDate" } };
                    break;
                default:
                    dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$fuelDate" } };
            }

            // Aggregate fuel data
            const fuelReport = await FuelLog.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            period: dateFormat,
                            carId: "$carId"
                        },
                        totalFuelAmount: { $sum: "$fuelAmountLiter" },
                        totalFuelCost: { $sum: "$fuelCost" },
                        avgFuelCost: { $avg: "$fuelCost" },
                        avgFuelAmount: { $avg: "$fuelAmountLiter" },
                        count: { $sum: 1 },
                        minOdometer: { $min: "$odometerReading" },
                        maxOdometer: { $max: "$odometerReading" },
                        entries: { $push: "$$ROOT" }
                    }
                },
                { $sort: { "_id.period": 1 } },
                {
                    $lookup: {
                        from: "cars",
                        localField: "_id.carId",
                        foreignField: "_id",
                        as: "carDetails"
                    }
                },
                { $unwind: { path: "$carDetails", preserveNullAndEmptyArrays: true } }
            ]);

            // Calculate overall totals
            const overallStats = await FuelLog.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalFuelAmount: { $sum: "$fuelAmountLiter" },
                        totalFuelCost: { $sum: "$fuelCost" },
                        avgFuelCost: { $avg: "$fuelCost" },
                        avgFuelAmount: { $avg: "$fuelAmountLiter" },
                        totalEntries: { $sum: 1 },
                        uniqueCars: { $addToSet: "$carId" }
                    }
                }
            ]);

            res.json({
                status: true,
                data: {
                    report: fuelReport,
                    summary: overallStats[0] || {
                        totalFuelAmount: 0,
                        totalFuelCost: 0,
                        avgFuelCost: 0,
                        avgFuelAmount: 0,
                        totalEntries: 0,
                        uniqueCars: []
                    },
                    period: {
                        startDate: startDate || 'All time',
                        endDate: endDate || 'All time',
                        groupBy
                    }
                }
            });

        } catch (error) {
            console.error("Get fuel report error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get fuel efficiency for a car
    getFuelEfficiency: async (req, res) => {
        try {
            const { carId } = req.params;
            const { startDate, endDate } = req.query;

            // Validate carId
            if (!mongoose.Types.ObjectId.isValid(carId)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            // Get car details
            const car = await Car.findById(carId);
            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // Build query
            let query = { carId };
            if (startDate || endDate) {
                query.fuelDate = {};
                if (startDate) {
                    query.fuelDate.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.fuelDate.$lte = new Date(endDate);
                }
            }

            // Get fuel logs sorted by date
            const fuelLogs = await FuelLog.find(query)
                .sort({ fuelDate: 1 });

            if (fuelLogs.length < 2) {
                return res.json({
                    status: true,
                    data: {
                        car: {
                            id: car._id,
                            name: car.name,
                            company: car.company,
                            model: car.model
                        },
                        message: "Not enough fuel logs to calculate efficiency",
                        fuelLogs: fuelLogs
                    }
                });
            }

            // Calculate efficiency between consecutive fuel logs
            const efficiencyData = [];
            for (let i = 1; i < fuelLogs.length; i++) {
                const current = fuelLogs[i];
                const previous = fuelLogs[i - 1];

                const distance = current.odometerReading - previous.odometerReading;
                const fuelUsed = current.fuelAmountLiter;

                if (distance > 0 && fuelUsed > 0) {
                    const efficiency = distance / fuelUsed; // km per liter
                    efficiencyData.push({
                        period: `${previous.fuelDate.toISOString().split('T')[0]} to ${current.fuelDate.toISOString().split('T')[0]}`,
                        distance,
                        fuelUsed,
                        efficiency: Math.round(efficiency * 100) / 100,
                        startOdometer: previous.odometerReading,
                        endOdometer: current.odometerReading
                    });
                }
            }

            // Calculate averages
            const avgEfficiency = efficiencyData.length > 0
                ? efficiencyData.reduce((sum, item) => sum + item.efficiency, 0) / efficiencyData.length
                : 0;

            res.json({
                status: true,
                data: {
                    car: {
                        id: car._id,
                        name: car.name,
                        company: car.company,
                        model: car.model,
                        currentOdometer: car.currentOdometer
                    },
                    efficiency: {
                        average: Math.round(avgEfficiency * 100) / 100,
                        data: efficiencyData,
                        totalLogs: fuelLogs.length,
                        period: {
                            startDate: fuelLogs[0].fuelDate,
                            endDate: fuelLogs[fuelLogs.length - 1].fuelDate
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Get fuel efficiency error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = FuelLogController;