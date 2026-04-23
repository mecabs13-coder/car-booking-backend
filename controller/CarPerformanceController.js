const Car = require("../model/CarModel");
const Booking = require("../model/BookingModel");
const JourneyLog = require("../model/JourneyLogModel");
const FuelLog = require("../model/FuelLogModel");
const mongoose = require("mongoose");

const CarPerformanceController = {
    // Get comprehensive car details with statistics
    carDetails: async (req, res) => {
        try {
            const {
                fuelType,
                search = "",
                page = 1,
                limit = 10,
                fromDate,
                toDate,
                sortBy = "totalBookings",
                sortOrder = "desc"
            } = req.query;

            // Set default date range if not provided (1st of current month to current date)
            let startDate, endDate;

            if (fromDate && toDate) {
                startDate = new Date(fromDate);
                endDate = new Date(toDate);
            } else {
                // Default: 1st of current month to current date
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
            }

            // Build filter for cars
            let carFilter = { isDeleted: false };

            // Filter by fuel type if provided
            if (fuelType && fuelType !== "all") {
                carFilter.fuelType = fuelType;
            }

            // Search by car name, company, model, or car number
            if (search && search.trim() !== "") {
                carFilter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { company: { $regex: search, $options: 'i' } },
                    { model: { $regex: search, $options: 'i' } },
                    { carNumber: { $regex: search, $options: 'i' } }
                ];
            }

            // Get pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get all cars with pagination
            const cars = await Car.find(carFilter)
                // .populate("driverId", "name email mobile")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const totalCars = await Car.countDocuments(carFilter);
            // console.log("carFilter", carFilter);
            // console.log("totalCars", totalCars);

            // Get statistics for each car
            const carStats = await Promise.all(
                cars.map(async (car) => {
                    // Get all bookings for this car within date range
                    const bookings = await Booking.find({
                        carId: car._id,
                        createdAt: { $gte: startDate, $lte: endDate }
                    });

                    const bookingIds = bookings.map(b => b._id);

                    // Get completed journeys for these bookings
                    const completedJourneys = await JourneyLog.find({
                        bookingId: { $in: bookingIds },
                        isCompleted: true
                    });

                    // Get fuel logs for this car within date range
                    const fuelLogs = await FuelLog.find({
                        carId: car._id,
                        fuelDate: { $gte: startDate, $lte: endDate }
                    });

                    // Calculate total distance from completed journeys
                    let totalDistance = 0;
                    completedJourneys.forEach(journey => {
                        if (journey.start && journey.end) {
                            totalDistance += (journey.end.odometerReading - journey.start.odometerReading);
                        }
                    });

                    // Calculate fuel statistics
                    const totalFuelLiters = fuelLogs.reduce((sum, log) => sum + log.fuelAmountLiter, 0);
                    const totalFuelCost = fuelLogs.reduce((sum, log) => sum + (log.fuelCost || 0), 0);

                    // Calculate average fuel efficiency (km per liter)
                    const avgFuelEfficiency = totalFuelLiters > 0
                        ? (totalDistance / totalFuelLiters).toFixed(2)
                        : 0;

                    // Calculate average fuel cost per km
                    const avgFuelCostPerKm = totalDistance > 0
                        ? (totalFuelCost / totalDistance).toFixed(2)
                        : 0;

                    // Get current odometer reading (latest from journey logs or car's current)
                    let currentOdometer = car.currentOdometer || 0;

                    // Find the latest completed journey end odometer
                    if (completedJourneys.length > 0) {
                        const latestJourney = completedJourneys.sort((a, b) =>
                            new Date(b.end?.recordedAt) - new Date(a.end?.recordedAt)
                        )[0];

                        if (latestJourney.end?.odometerReading) {
                            currentOdometer = latestJourney.end.odometerReading;
                        }
                    }

                    // Calculate days since last journey
                    let daysSinceLastJourney = null;
                    if (completedJourneys.length > 0) {
                        const latestJourney = completedJourneys.sort((a, b) =>
                            new Date(b.end?.recordedAt) - new Date(a.end?.recordedAt)
                        )[0];

                        if (latestJourney.end?.recordedAt) {
                            const lastJourneyDate = new Date(latestJourney.end.recordedAt);
                            const today = new Date();
                            const diffTime = Math.abs(today.getTime() - lastJourneyDate.getTime());
                            daysSinceLastJourney = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }

                    return {
                        _id: car._id,
                        name: car.name,
                        image: car.image,
                        company: car.company,
                        model: car.model,
                        carNumber: car.carNumber,
                        fuelType: car.fuelType,
                        personSeating: car.personSeating,
                        driverId: car.driverId,
                        isActive: car.isActive,
                        currentOdometer,

                        // Statistics
                        totalBookings: bookings.length,
                        totalCompletedJourneys: completedJourneys.length,
                        totalDistance: Math.round(totalDistance * 100) / 100,
                        totalFuelLiters: Math.round(totalFuelLiters * 100) / 100,
                        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
                        avgFuelEfficiency: avgFuelEfficiency,
                        avgFuelCostPerKm: avgFuelCostPerKm,
                        daysSinceLastJourney,

                        // Fuel logs for detailed view
                        fuelLogs: fuelLogs.map(log => ({
                            _id: log._id,
                            odometerReading: log.odometerReading,
                            fuelAmountLiter: log.fuelAmountLiter,
                            fuelCost: log.fuelCost,
                            fuelDate: log.fuelDate
                        })),

                        // Period
                        period: {
                            fromDate: startDate,
                            toDate: endDate
                        }
                    };
                })
            );

            // Sort the results
            const sortedStats = carStats.sort((a, b) => {
                let aValue = a[sortBy] || 0;
                let bValue = b[sortBy] || 0;

                if (sortOrder === "desc") {
                    return bValue - aValue;
                } else {
                    return aValue - bValue;
                }
            });

            // Calculate overall statistics
            const overallStats = {
                totalCars: totalCars,
                totalBookings: carStats.reduce((sum, car) => sum + car.totalBookings, 0),
                totalDistance: carStats.reduce((sum, car) => sum + car.totalDistance, 0),
                totalFuelLiters: carStats.reduce((sum, car) => sum + car.totalFuelLiters, 0),
                totalFuelCost: carStats.reduce((sum, car) => sum + car.totalFuelCost, 0),
                avgFuelEfficiency: carStats.reduce((sum, car) => sum + (parseFloat(car.avgFuelEfficiency) || 0), 0) / carStats.length || 0,
                activeCars: carStats.filter(car => car.isActive).length,
                inactiveCars: carStats.filter(car => !car.isActive).length
            };

            return res.json({
                status: true,
                data: sortedStats,
                overallStats,
                pagination: {
                    total: totalCars,
                    page: parseInt(page),
                    totalPages: Math.ceil(totalCars / parseInt(limit)),
                    limit: parseInt(limit)
                },
                filters: {
                    fuelType: fuelType || "all",
                    search,
                    period: {
                        fromDate: startDate,
                        toDate: endDate
                    }
                }
            });

        } catch (error) {
            console.error("Car details error:", error);
            return res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get single car detailed report
    getCarDetailedReport: async (req, res) => {
        try {
            const { carId } = req.params;
            const { fromDate, toDate } = req.query;

            // Validate car ID
            if (!mongoose.Types.ObjectId.isValid(carId)) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid car ID format"
                });
            }

            // Set date range
            let startDate, endDate;
            if (fromDate && toDate) {
                startDate = new Date(fromDate);
                endDate = new Date(toDate);
            } else {
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
            }

            // Get car details
            const car = await Car.findById(carId)/* .populate("driverId", "name email mobile") */;

            if (!car) {
                return res.status(404).json({
                    status: false,
                    message: "Car not found"
                });
            }

            // Get all bookings for this car
            const bookings = await Booking.find({
                carId: car._id,
                createdAt: { $gte: startDate, $lte: endDate }
            }).populate("customerId", "name email mobile")
                .populate("driverId", "name email mobile")
                .sort({ createdAt: -1 });

            const bookingIds = bookings.map(b => b._id);

            // Get journey logs
            const journeyLogs = await JourneyLog.find({
                bookingId: { $in: bookingIds }
            }).sort({ createdAt: -1 });

            // Get fuel logs
            const fuelLogs = await FuelLog.find({
                carId: car._id,
                fuelDate: { $gte: startDate, $lte: endDate }
            }).sort({ fuelDate: -1 });

            // Calculate daily statistics
            const dailyStats = [];
            const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

            for (let i = 0; i <= days; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);

                const dayStart = new Date(date.setHours(0, 0, 0, 0));
                const dayEnd = new Date(date.setHours(23, 59, 59, 999));

                const dayJourneys = journeyLogs.filter(j =>
                    j.start.recordedAt >= dayStart && j.start.recordedAt <= dayEnd
                );

                const dayFuel = fuelLogs.filter(f =>
                    f.fuelDate >= dayStart && f.fuelDate <= dayEnd
                );

                const dayDistance = dayJourneys.reduce((sum, j) => {
                    if (j.end) {
                        return sum + (j.end.odometerReading - j.start.odometerReading);
                    }
                    return sum;
                }, 0);

                dailyStats.push({
                    date,
                    journeys: dayJourneys.length,
                    distance: dayDistance,
                    fuelLiters: dayFuel.reduce((sum, f) => sum + f.fuelAmountLiter, 0),
                    fuelCost: dayFuel.reduce((sum, f) => sum + (f.fuelCost || 0), 0)
                });
            }

            return res.json({
                status: true,
                data: {
                    car,
                    bookings,
                    journeyLogs,
                    fuelLogs,
                    dailyStats,
                    period: {
                        fromDate: startDate,
                        toDate: endDate
                    },
                    summary: {
                        totalBookings: bookings.length,
                        totalJourneys: journeyLogs.filter(j => j.isCompleted).length,
                        totalDistance: journeyLogs.reduce((sum, j) => {
                            if (j.end) {
                                return sum + (j.end.odometerReading - j.start.odometerReading);
                            }
                            return sum;
                        }, 0),
                        totalFuelLiters: fuelLogs.reduce((sum, f) => sum + f.fuelAmountLiter, 0),
                        totalFuelCost: fuelLogs.reduce((sum, f) => sum + (f.fuelCost || 0), 0)
                    }
                }
            });

        } catch (error) {
            console.error("Car detailed report error:", error);
            return res.status(500).json({
                status: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = CarPerformanceController;