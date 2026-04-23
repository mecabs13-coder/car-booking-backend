const { default: mongoose } = require("mongoose");
const { deleteImageFile } = require("../config/Helper");
const Booking = require("../model/BookingModel");
const JourneyLog = require("../model/JourneyLogModel");
const Car = require("../model/CarModel");
const User = require("../model/UserModel");

const JourneyLogController = {

    // Check journey logs
    checkDriverJourneyStatus: async (req, res) => {
        try {
            const journeyLogs = await JourneyLog.findOne({ driverId: req.driverId, isCompleted: false });
            res.json({
                status: true,
                isCompleted: journeyLogs?.isCompleted ?? true
            });

        } catch (error) {
            console.error("Get journey logs by booking error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Create journey log (start journey)
    startJourney: async (req, res) => {
        try {
            const { bookingId, odometerReading } = req.body;

            // Validation
            if (!bookingId || !odometerReading) {
                // If validation fails, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(400).json({
                    status: false,
                    message: "Please provide bookingId and odometerReading"
                });
            }
            const journeyLogs = await JourneyLog.findOne({ driverId: req.driverId, isCompleted: false });
            if (journeyLogs) {
                return res.status(404).json({ status: false, message: "one Journey is already started" });
            }

            // Validate booking exists and is in correct state
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                // If booking not found, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(404).json({ status: false, message: "Booking not found" });
            }

            // Check if journey log already exists for this booking
            const existingLog = await JourneyLog.findOne({ bookingId });
            if (existingLog) {
                // If log exists, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(400).json({ status: false, message: "Journey log already exists for this booking" });
            }

            // Handle odometer image upload
            if (!req.file) {
                return res.status(400).json({ status: false, message: "Please provide odometer start image" });
            }

            // Create journey log
            const journeyLog = new JourneyLog({
                bookingId,
                driverId: req.driverId,
                start: {
                    odometerImage: req.file.filename,
                    odometerReading: parseFloat(odometerReading),
                    recordedAt: new Date()
                }
            });

            booking.journeyStatus = "On-Going";
            await booking.save();
            await journeyLog.save();

            // Populate booking details in response
            await journeyLog.populate("bookingId");

            res.status(201).json({
                status: true,
                message: "Journey started successfully",
                data: journeyLog
            });

        } catch (error) {
            // If error occurs, delete uploaded image
            if (req.file) {
                await deleteImageFile('journey-logs', req.file.filename);
            }

            console.error("Start journey error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // End journey (update journey log with end details)
    endJourney: async (req, res) => {
        try {
            const { id } = req.params;
            const { odometerReading } = req.body;

            // Validation
            if (!odometerReading) {
                // If validation fails, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(400).json({
                    status: false,
                    message: "Please provide odometerReading"
                });
            }

            // Find journey log
            const journeyLog = await JourneyLog.findById(id);
            if (!journeyLog) {
                // If log not found, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(404).json({
                    status: false,
                    message: "Journey log not found"
                });
            }

            // Check if journey already ended
            if (journeyLog.end && journeyLog.end.odometerReading) {
                // If already ended, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(400).json({
                    status: false,
                    message: "Journey already ended"
                });
            }

            // Handle odometer image upload
            if (!req.file) {
                return res.status(400).json({
                    status: false,
                    message: "Please provide odometer end image"
                });
            }

            // Update journey log with end details
            journeyLog.isCompleted = true
            journeyLog.end = {
                odometerImage: req.file.filename,
                odometerReading: parseFloat(odometerReading),
                recordedAt: new Date()
            };


            await Booking.findByIdAndUpdate(journeyLog.bookingId, { isJourneyComplete: true, journeyStatus: "Completed" });
            await journeyLog.save();

            // Populate booking details in response
            await journeyLog.populate("bookingId");

            res.json({
                status: true,
                message: "Journey ended successfully",
                data: journeyLog
            });

        } catch (error) {
            // If error occurs, delete uploaded image
            if (req.file) {
                await deleteImageFile('journey-logs', req.file.filename);
            }

            console.error("End journey error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all journey logs with pagination and filters for ADMIN & Driver( driver get only own journey)
    getAllJourneyLogs: async (req, res) => {
        try {
            const driverId = req.driverId;
            const {
                page = 1,
                limit = 10,
                bookingId,
                startDate,
                endDate,
                status, // 'ongoing' or 'completed'
                sortBy = "createdAt",
                sortOrder = "desc"
            } = req.query;

            // Build query
            let query = {};
            if (driverId && req.role === 2) {
                query.driverId = driverId;
            }

            if (bookingId) {
                query.bookingId = bookingId;
            }

            // Filter by status (ongoing = no end data, completed = has end data)
            if (status === 'ongoing') {
                query['end.odometerReading'] = { $exists: false };
            } else if (status === 'completed') {
                query['end.odometerReading'] = { $exists: true };
            }

            // Date range filters
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute queries with population
            const journeyLogs = await JourneyLog.find(query)
                .populate({
                    path: "bookingId",
                    populate: [
                        { path: "customerId", select: "name email mobile" },
                        { path: "carId", select: "name company model image" },
                        { path: "driverId", select: "name email mobile image" }
                    ]
                })
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));

            const total = await JourneyLog.countDocuments(query);

            // Calculate journey statistics
            const journeyStats = journeyLogs.map(log => {
                const stats = {
                    _id: log._id,
                    bookingId: log.bookingId,
                    start: log.start,
                    end: log.end,
                    createdAt: log.createdAt,
                    updatedAt: log.updatedAt
                };

                if (log.end && log.end.odometerReading) {
                    stats.distance = log.end.odometerReading - log.start.odometerReading;
                    stats.journeyDuration = new Date(log.end.recordedAt) - new Date(log.start.recordedAt);
                }

                return stats;
            });

            res.json({
                status: true,
                data: journeyStats,
                pagination: {
                    total,
                    page: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    limit: parseInt(limit)
                },
                filters: {
                    bookingId,
                    startDate,
                    endDate,
                    status
                }
            });

        } catch (error) {
            console.error("Get all journey logs error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get journey log by ID for ADMIN
    getJourneyLogById: async (req, res) => {
        try {
            const { id } = req.params;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid journey log ID format"
                });
            }

            const journeyLog = await JourneyLog.findById(id)
                .populate({
                    path: "bookingId",
                    populate: [
                        { path: "customerId", select: "name email mobile" },
                        { path: "carId", select: "name company model image" },
                        { path: "driverId", select: "name email mobile image" }
                    ]
                });

            if (!journeyLog) {
                return res.status(404).json({
                    status: false,
                    message: "Journey log not found"
                });
            }

            // Calculate journey statistics
            const response = journeyLog.toObject();
            if (journeyLog.end && journeyLog.end.odometerReading) {
                response.distance = journeyLog.end.odometerReading - journeyLog.start.odometerReading;
                response.journeyDuration = new Date(journeyLog.end.recordedAt) - new Date(journeyLog.start.recordedAt);
            }

            res.json({
                status: true,
                data: response
            });

        } catch (error) {
            console.error("Get journey log by ID error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get journey logs by booking ID
    getJourneyLogsByBooking: async (req, res) => {
        try {
            const { bookingId } = req.params;

            // Validate bookingId
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid booking ID format"
                });
            }

            const journeyLogs = await JourneyLog.find({ bookingId })
                .populate({
                    path: "bookingId",
                    populate: [
                        { path: "customerId", select: "name email mobile" },
                        { path: "carId", select: "name company model image" },
                        { path: "driverId", select: "name email mobile image" }
                    ]
                })
                .sort({ createdAt: -1 });

            res.json({
                status: true,
                data: journeyLogs
            });

        } catch (error) {
            console.error("Get journey logs by booking error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update journey log (admin only, for corrections) for ADMIN
    updateJourneyLog: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                // If invalid ID, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(400).json({
                    status: false,
                    message: "Invalid journey log ID format"
                });
            }

            // Find journey log
            const journeyLog = await JourneyLog.findById(id);
            if (!journeyLog) {
                // If log not found, delete uploaded image
                if (req.file) {
                    await deleteImageFile('journey-logs', req.file.filename);
                }

                return res.status(404).json({
                    status: false,
                    message: "Journey log not found"
                });
            }

            // Handle image upload for start
            if (req.files && req.files.startImage) {
                // Delete old start image if exists
                if (journeyLog.start && journeyLog.start.odometerImage) {
                    await deleteImageFile('journey-logs', journeyLog.start.odometerImage);
                }

                if (!journeyLog.start) {
                    journeyLog.start = {};
                }
                journeyLog.start.odometerImage = req.files.startImage[0].filename;
            }

            // Handle image upload for end
            if (req.files && req.files.endImage) {
                // Delete old end image if exists
                if (journeyLog.end && journeyLog.end.odometerImage) {
                    await deleteImageFile('journey-logs', journeyLog.end.odometerImage);
                }

                if (!journeyLog.end) {
                    journeyLog.end = {};
                }
                journeyLog.end.odometerImage = req.files.endImage[0].filename;
            }

            // Update start details
            if (updates.startOdometerReading) {
                if (!journeyLog.start) journeyLog.start = {};
                journeyLog.start.odometerReading = parseFloat(updates.startOdometerReading);
            }
            if (updates.startRecordedAt) {
                if (!journeyLog.start) journeyLog.start = {};
                journeyLog.start.recordedAt = new Date(updates.startRecordedAt);
            }

            // Update end details
            if (updates.endOdometerReading) {
                if (!journeyLog.end) journeyLog.end = {};
                journeyLog.end.odometerReading = parseFloat(updates.endOdometerReading);
            }
            if (updates.endRecordedAt) {
                if (!journeyLog.end) journeyLog.end = {};
                journeyLog.end.recordedAt = new Date(updates.endRecordedAt);
            }

            await journeyLog.save();

            // Populate booking details in response
            await journeyLog.populate({
                path: "bookingId",
                populate: [
                    { path: "customerId", select: "name email mobile" },
                    { path: "carId", select: "name company model image" },
                    { path: "driverId", select: "name email mobile image" }
                ]
            });

            res.json({
                status: true,
                message: "Journey log updated successfully",
                data: journeyLog
            });

        } catch (error) {
            // If error occurs, delete uploaded images
            if (req.files) {
                if (req.files.startImage) {
                    await deleteImageFile('journey-logs', req.files.startImage[0].filename);
                }
                if (req.files.endImage) {
                    await deleteImageFile('journey-logs', req.files.endImage[0].filename);
                }
            }

            console.error("Update journey log error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete journey log for ADMIN
    deleteJourneyLog: async (req, res) => {
        try {
            const { id } = req.params;
            const { permanent = false } = req.query;

            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid journey log ID format"
                });
            }

            // Check if journey log exists
            const journeyLog = await JourneyLog.findById(id);
            if (!journeyLog) {
                return res.status(404).json({
                    status: false,
                    message: "Journey log not found"
                });
            }

            if (permanent === 'true') {
                // Delete associated images
                if (journeyLog.start && journeyLog.start.odometerImage) {
                    await deleteImageFile('journey-logs', journeyLog.start.odometerImage);
                }
                if (journeyLog.end && journeyLog.end.odometerImage) {
                    await deleteImageFile('journey-logs', journeyLog.end.odometerImage);
                }

                // Permanent delete
                await JourneyLog.findByIdAndDelete(id);
            } else {
                // Soft delete - you might want to add an isActive field to schema
                // For now, we'll just return error as soft delete might not be applicable
                return res.status(400).json({
                    status: false,
                    message: "Permanent delete required for journey logs. Use ?permanent=true"
                });
            }

            res.json({
                status: true,
                message: "Journey log deleted successfully"
            });

        } catch (error) {
            console.error("Delete journey log error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get journey statistics 
    getJourneyStatistics: async (req, res) => {
        try {
            const { startDate, endDate, driverId, carId } = req.query;

            // Build query for date range
            let query = {};

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }

            // Get all completed journeys
            const completedJourneys = await JourneyLog.find({
                ...query,
                'end.odometerReading': { $exists: true }
            }).populate('bookingId');

            // Filter by driver or car if needed
            let filteredJourneys = completedJourneys;
            if (driverId || carId) {
                filteredJourneys = completedJourneys.filter(log => {
                    if (driverId && log.bookingId.driverId?.toString() !== driverId) return false;
                    if (carId && log.bookingId.carId?.toString() !== carId) return false;
                    return true;
                });
            }

            // Calculate statistics
            const totalJourneys = filteredJourneys.length;
            const totalDistance = filteredJourneys.reduce((sum, log) => {
                return sum + (log.end.odometerReading - log.start.odometerReading);
            }, 0);

            const totalDuration = filteredJourneys.reduce((sum, log) => {
                const duration = new Date(log.end.recordedAt) - new Date(log.start.recordedAt);
                return sum + duration;
            }, 0);

            const averageDistance = totalJourneys > 0 ? totalDistance / totalJourneys : 0;
            const averageDuration = totalJourneys > 0 ? totalDuration / totalJourneys : 0;

            // Ongoing journeys
            const ongoingJourneys = await JourneyLog.countDocuments({
                ...query,
                'end.odometerReading': { $exists: false }
            });

            res.json({
                status: true,
                data: {
                    totalJourneys,
                    ongoingJourneys,
                    totalDistance: Math.round(totalDistance * 100) / 100,
                    totalDuration: Math.round(totalDuration / 1000 / 60), // in minutes
                    averageDistance: Math.round(averageDistance * 100) / 100,
                    averageDuration: Math.round(averageDuration / 1000 / 60 * 100) / 100, // in minutes
                    period: {
                        startDate: startDate || 'All time',
                        endDate: endDate || 'All time'
                    }
                }
            });

        } catch (error) {
            console.error("Get journey statistics error:", error);
            res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = JourneyLogController;