const Booking = require("../model/BookingModel");
const Car = require("../model/CarModel");
const User = require("../model/UserModel");
const JourneyLog = require("../model/JourneyLogModel");
const mongoose = require("mongoose");

const DashboardController = {
    // Admin Dashboard
    AdminDashboard: async (req, res) => {
        try {
            // Get current date for date-based filters
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfYear = new Date(today.getFullYear(), 0, 1);

            // ========== DRIVER STATISTICS ==========
            const totalDrivers = await User.countDocuments({
                role: 2,
                isDeleted: { $ne: true }
            });

            const activeDrivers = await User.countDocuments({
                role: 2,
                isActive: true,
                isDeleted: { $ne: true }
            });

            const inactiveDrivers = totalDrivers - activeDrivers;

            // Drivers joined this month
            const newDriversThisMonth = await User.countDocuments({
                role: 2,
                createdAt: { $gte: startOfMonth },
                isDeleted: { $ne: true }
            });

            // ========== CAR STATISTICS ==========
            const totalCars = await Car.countDocuments({
                isDeleted: { $ne: true }
            });

            const activeCars = await Car.countDocuments({
                isActive: true,
                isDeleted: { $ne: true }
            });

            const inactiveCars = totalCars - activeCars;

            // Cars by fuel type
            const carsByFuelType = await Car.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: "$fuelType",
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            // // Cars without assigned drivers
            // const carsWithoutDrivers = await Car.countDocuments({
            //     $or: [
            //         { driverId: { $exists: false } },
            //         { driverId: null }
            //     ],
            //     isDeleted: { $ne: true }
            // });

            // ========== BOOKING STATISTICS ==========
            const totalBookings = await Booking.countDocuments();

            // Bookings by status
            const bookingsByStatus = {
                booked: await Booking.countDocuments({ status: "Booked" }),
                cancelled: await Booking.countDocuments({ status: "Cancelled" })
            };

            // Bookings by journey status
            const bookingsByJourneyStatus = {
                notStarted: await Booking.countDocuments({ journeyStatus: "Not-Started" }),
                ongoing: await Booking.countDocuments({ journeyStatus: "On-Going" }),
                completed: await Booking.countDocuments({ journeyStatus: "Completed" })
            };

            // Today's bookings
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));

            const todayBookings = await Booking.countDocuments({
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            // This month's bookings
            const thisMonthBookings = await Booking.countDocuments({
                createdAt: { $gte: startOfMonth }
            });

            // This year's bookings
            const thisYearBookings = await Booking.countDocuments({
                createdAt: { $gte: startOfYear }
            });

            // Revenue statistics (if you have totalAmount field)
            // const totalRevenue = await Booking.aggregate([
            //     { $match: { status: "Booked", journeyStatus: "Completed" } },
            //     { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            // ]);

            // ========== MONTHLY TRENDS ==========
            // Last 6 months booking trends
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const monthlyBookings = await Booking.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" }
                        },
                        count: { $sum: 1 },
                        completed: {
                            $sum: { $cond: [{ $eq: ["$journeyStatus", "Completed"] }, 1, 0] }
                        },
                        cancelled: {
                            $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] }
                        }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]);

            // Format monthly data for charts
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const bookingTrends = monthlyBookings.map(item => ({
                month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
                total: item.count,
                completed: item.completed,
                cancelled: item.cancelled
            }));

            // ========== RECENT ACTIVITIES ==========
            const recentBookings = await Booking.find()
                .populate("customerId", "name email mobile")
                .populate("carId", "name carNumber")
                .populate("driverId", "name")
                .sort({ createdAt: -1 })
                .limit(5);

            // ========== TOP PERFORMERS ==========
            // Top drivers by completed journeys
            const topDrivers = await Booking.aggregate([
                { $match: { journeyStatus: "Completed" } },
                {
                    $group: {
                        _id: "$driverId",
                        completedBookings: { $sum: 1 }
                    }
                },
                { $sort: { completedBookings: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "driverInfo"
                    }
                },
                { $unwind: "$driverInfo" },
                {
                    $project: {
                        driverName: "$driverInfo.name",
                        driverMobile: "$driverInfo.mobile",
                        completedBookings: 1
                    }
                }
            ]);

            // Top cars by usage
            const topCars = await Booking.aggregate([
                { $match: { journeyStatus: "Completed" } },
                {
                    $group: {
                        _id: "$carId",
                        totalBookings: { $sum: 1 }
                    }
                },
                { $sort: { totalBookings: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "cars",
                        localField: "_id",
                        foreignField: "_id",
                        as: "carInfo"
                    }
                },
                { $unwind: "$carInfo" },
                {
                    $project: {
                        carName: "$carInfo.name",
                        carNumber: "$carInfo.carNumber",
                        totalBookings: 1
                    }
                }
            ]);

            return res.json({
                status: true,
                data: {
                    // Driver statistics
                    drivers: {
                        total: totalDrivers,
                        active: activeDrivers,
                        inactive: inactiveDrivers,
                        newThisMonth: newDriversThisMonth
                    },
                    // Car statistics
                    cars: {
                        total: totalCars,
                        active: activeCars,
                        inactive: inactiveCars,
                        // withoutDrivers: carsWithoutDrivers,
                        byFuelType: carsByFuelType
                    },
                    // Booking statistics
                    bookings: {
                        total: totalBookings,
                        byStatus: bookingsByStatus,
                        byJourneyStatus: bookingsByJourneyStatus,
                        today: todayBookings,
                        thisMonth: thisMonthBookings,
                        thisYear: thisYearBookings
                    },
                    // Trends and analytics
                    trends: {
                        monthly: bookingTrends
                    },
                    // Recent activities
                    recentBookings: recentBookings.map(booking => ({
                        id: booking._id,
                        bookingNumber: booking.bookingNumber,
                        customer: booking.customerId?.name || "Unknown",
                        car: booking.carId?.name || "Unknown",
                        carNumber: booking.carId?.carNumber,
                        driver: booking.driverId?.name || "Unknown",
                        status: booking.status,
                        journeyStatus: booking.journeyStatus,
                        createdAt: booking.createdAt
                    })),
                    // Top performers
                    topDrivers,
                    topCars
                }
            });

        } catch (error) {
            console.error("Admin Dashboard Error:", error);
            res.status(500).json({
                status: false,
                message: "Error Fetching Dashboard Data",
                error: error.message
            });
        }
    },

    // Driver Dashboard
    DriverDashboard: async (req, res) => {
        try {
            const driverId = req.driverId;

            // Verify driver exists
            const driver = await User.findOne({
                _id: driverId,
                role: 2,
                isDeleted: { $ne: true }
            });

            if (!driver) {
                return res.status(404).json({
                    status: false,
                    message: "Driver not found"
                });
            }

            // Get current date for filters
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

            // ========== BOOKING STATISTICS ==========
            const totalBookings = await Booking.countDocuments({ driverId });

            // Bookings by status
            const bookingsByStatus = {
                booked: await Booking.countDocuments({ driverId, status: "Booked" }),
                cancelled: await Booking.countDocuments({ driverId, status: "Cancelled" })
            };

            // Bookings by journey status
            const bookingsByJourneyStatus = {
                notStarted: await Booking.countDocuments({ driverId, journeyStatus: "Not-Started" }),
                ongoing: await Booking.countDocuments({ driverId, journeyStatus: "On-Going" }),
                completed: await Booking.countDocuments({ driverId, journeyStatus: "Completed" })
            };

            // Today's bookings
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));

            const todayBookings = await Booking.countDocuments({
                driverId,
                fromDate: { $lte: endOfDay },
                toDate: { $gte: startOfDay }
            });

            // This week's bookings
            const thisWeekBookings = await Booking.countDocuments({
                driverId,
                createdAt: { $gte: startOfWeek }
            });

            // This month's bookings
            const thisMonthBookings = await Booking.countDocuments({
                driverId,
                createdAt: { $gte: startOfMonth }
            });

            // ========== UPCOMING BOOKINGS ==========
            const upcomingBookings = await Booking.find({
                driverId,
                fromDate: { $gte: new Date() },
                status: "Booked",
                journeyStatus: "Not-Started"
            })
                .populate("customerId", "name email mobile")
                .populate("carId", "name carNumber fuelType")
                .sort({ fromDate: 1 })
                .limit(5);

            // ========== CURRENT ONGOING JOURNEY ==========
            const ongoingJourney = await Booking.findOne({
                driverId,
                journeyStatus: "On-Going"
            })
                .populate("customerId", "name email mobile")
                .populate("carId", "name carNumber fuelType image")
                .sort({ updatedAt: -1 });

            // Get journey log for ongoing journey
            let journeyLog = null;
            if (ongoingJourney) {
                journeyLog = await JourneyLog.findOne({
                    bookingId: ongoingJourney._id,
                    isCompleted: false
                });
            }

            // ========== RECENT COMPLETED JOURNEYS ==========
            const recentCompleted = await Booking.find({
                driverId,
                journeyStatus: "Completed"
            })
                .populate("customerId", "name")
                .populate("carId", "name carNumber")
                .sort({ updatedAt: -1 })
                .limit(5);

            // ========== PERFORMANCE METRICS ==========
            // Total distance covered
            const journeyLogs = await JourneyLog.find({
                driverId,
                isCompleted: true
            });

            const totalDistance = journeyLogs.reduce((sum, log) => {
                if (log.end) {
                    return sum + (log.end.odometerReading - log.start.odometerReading);
                }
                return sum;
            }, 0);

            // Average rating (if you have ratings)
            // const averageRating = await Rating.aggregate(...)

            // ========== MONTHLY TRENDS ==========
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const monthlyPerformance = await Booking.aggregate([
                {
                    $match: {
                        driverId: new mongoose.Types.ObjectId(driverId),
                        createdAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" }
                        },
                        total: { $sum: 1 },
                        completed: {
                            $sum: { $cond: [{ $eq: ["$journeyStatus", "Completed"] }, 1, 0] }
                        },
                        cancelled: {
                            $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] }
                        }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]);

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const performanceTrends = monthlyPerformance.map(item => ({
                month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
                total: item.total,
                completed: item.completed,
                cancelled: item.cancelled
            }));

            return res.json({
                status: true,
                data: {
                    driverInfo: {
                        id: driver._id,
                        name: driver.name,
                        email: driver.email,
                        mobile: driver.mobile,
                        image: driver.image
                    },
                    // Booking statistics
                    bookings: {
                        total: totalBookings,
                        byStatus: bookingsByStatus,
                        byJourneyStatus: bookingsByJourneyStatus,
                        today: todayBookings,
                        thisWeek: thisWeekBookings,
                        thisMonth: thisMonthBookings
                    },
                    // Current status
                    current: {
                        ongoingJourney: ongoingJourney ? {
                            bookingId: ongoingJourney._id,
                            bookingNumber: ongoingJourney.bookingNumber,
                            customer: ongoingJourney.customerId,
                            car: ongoingJourney.carId,
                            fromLocation: ongoingJourney.fromLocation,
                            toLocation: ongoingJourney.toLocation,
                            fromDate: ongoingJourney.fromDate,
                            toDate: ongoingJourney.toDate,
                            journeyLog: journeyLog ? {
                                startOdometer: journeyLog.start.odometerReading,
                                startTime: journeyLog.start.recordedAt,
                                startImage: journeyLog.start.odometerImage
                            } : null
                        } : null
                    },
                    // Lists
                    upcomingBookings: upcomingBookings.map(booking => ({
                        id: booking._id,
                        bookingNumber: booking.bookingNumber,
                        customer: booking.customerId,
                        car: booking.carId,
                        fromLocation: booking.fromLocation,
                        toLocation: booking.toLocation,
                        fromDate: booking.fromDate,
                        toDate: booking.toDate
                    })),
                    recentCompleted: recentCompleted.map(booking => ({
                        id: booking._id,
                        bookingNumber: booking.bookingNumber,
                        customer: booking.customerId?.name || "Unknown",
                        car: booking.carId?.name || "Unknown",
                        carNumber: booking.carId?.carNumber,
                        fromLocation: booking.fromLocation,
                        toLocation: booking.toLocation,
                        completedAt: booking.updatedAt
                    })),
                    // Performance metrics
                    performance: {
                        totalDistance: Math.round(totalDistance * 100) / 100,
                        completedJobs: bookingsByJourneyStatus.completed,
                        trends: performanceTrends
                    }
                }
            });

        } catch (error) {
            console.error("Driver Dashboard Error:", error);
            res.status(500).json({
                status: false,
                message: "Error Fetching Dashboard Data",
                error: error.message
            });
        }
    }
};

module.exports = DashboardController;