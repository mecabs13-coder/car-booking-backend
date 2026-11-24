const { default: mongoose } = require("mongoose");
const Booking = require("../model/BookingModel");
const Car = require("../model/CarModel");
const User = require("../model/UserModel");
// const { sendWhatsAppMessage } = require("../config/whatsapp");

const BookingController = {
  // Create a new booking
  createBooking: async (req, res) => {
    try {
      const {
        carId,
        driverId,
        customerId,
        fromLocation,
        toLocation,
        fromDate,
        toDate,
        totalHours,
        totalAmount,
      } = req.body;

      // Check if car exists
      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }
      // if (!car.driverId || car.driverId == "") {
      //     return res.status(404).json({ message: "Selected Car Doesn't have driver" });
      // }

      // Check if car is available for the given dates
      const existingBooking = await Booking.findOne({
        carId,
        status: "Booked",
        $or: [{ fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }],
      });

      if (existingBooking) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Car is not available for the selected dates",
          });
      }

      const newBooking = new Booking({
        carId,
        customerId,
        driverId: car.driverId,
        // driverId,
        fromLocation,
        toLocation,
        fromDate,
        toDate,
        totalHours,
        totalAmount,
        status: "Booked",
        isJourneyComplete: false,
      });

      await newBooking.save();
      // // Get customer and driver details
      // const customer = await User.findById(customerId);
      // const driver = await User.findById(car.driverId);

      // // Format dates
      // const from = new Date(fromDate).toLocaleString();
      // const to = new Date(toDate).toLocaleString();

      // // 📩 Message for Customer
      // const customerMessage = `
      // 🚗 Booking Confirmed!

      // Booking No: ${newBooking.bookingNumber}
      // Car: ${car.name}
      // Driver: ${driver.name}
      // Driver Phone: ${driver.mobile}

      // From: ${fromLocation}
      // To: ${toLocation}
      // Date: ${from} - ${to}

      // Thank you for booking with us!
      // `;

      // // 📩 Message for Driver
      // const driverMessage = `
      // 🚗 New Booking Assigned!

      // Booking No: ${newBooking.bookingNumber}

      // Customer: ${customer.name}
      // Customer Phone: ${customer.mobile}

      // Pickup: ${fromLocation}
      // Drop: ${toLocation}
      // Date: ${from} - ${to}

      // Please contact customer before journey.
      // `;

      // // Send WhatsApp
      // await sendWhatsAppMessage(customer.phone, customerMessage);
      // await sendWhatsAppMessage(driver.phone, driverMessage);
      res
        .status(201)
        .json({
          success: true,
          message: "Booking created successfully",
          booking: newBooking,
        });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: "Error creating booking",
          error: error.message,
        });
    }
  },

  // Get all bookings with filters and pagination
  getAllBookings: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        status,
        isJourneyComplete,
        startDate,
        endDate,
      } = req.query;

      // Build filter object
      const filter = {};

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Journey complete filter
      if (isJourneyComplete !== undefined) {
        filter.isJourneyComplete = isJourneyComplete === "true";
      }

      // Date range filter
      if (startDate && endDate) {
        filter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      // Search functionality (search in customer name, email, car details, locations)
      if (search) {
        // First, find customers and cars that match the search
        const customers = await User.find({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { mobile: { $regex: search, $options: "i" } },
          ],
        }).select("_id");

        const cars = await Car.find({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { company: { $regex: search, $options: "i" } },
            { model: { $regex: search, $options: "i" } },
          ],
        }).select("_id");

        const customerIds = customers.map((c) => c._id);
        const carIds = cars.map((c) => c._id);

        filter.$or = [
          { customerId: { $in: customerIds } },
          { carId: { $in: carIds } },
          { fromLocation: { $regex: search, $options: "i" } },
          { toLocation: { $regex: search, $options: "i" } },
          { bookingNumber: { $regex: search, $options: "i" } },
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOrderValue = sortOrder === "desc" ? -1 : 1;

      // Execute query with pagination
      const bookings = await Booking.find(filter)
        .populate("carId")
        .populate("customerId")
        .populate("driverId")
        .sort({ [sortBy]: sortOrderValue })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count for pagination
      const totalBookings = await Booking.countDocuments(filter);

      // Calculate total pages
      const totalPages = Math.ceil(totalBookings / parseInt(limit));

      res.status(200).json({
        status: true,
        data: bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalBookings,
          pages: totalPages,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: "Error fetching bookings",
        error: error.message,
      });
    }
  },

  // Get booking by ID
  getBookingById: async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await Booking.findById(id)
        .populate("carId")
        .populate("customerId")
        .populate("driverId");

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.status(200).json(booking);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching booking", error: error.message });
    }
  },

  getBookingDataToStartjourney: async (req, res) => {
    try {
      const driverId = req.driverId;

      // Check if driver exists
      const driver = await User.findOne({ _id: driverId, role: 2 });
      if (!driver) {
        return res
          .status(404)
          .json({ status: false, message: "Driver not found" });
      }

      // // Get all cars assigned to this driver that are active
      // const cars = await Car.find({
      //     driverId,
      //     isActive: true
      // }).select('name company model image fuelType').sort({ createdAt: -1 }).populate("driverId");;

      // if (cars.length === 0) {
      //     return res.json({
      //         status: true,
      //         data: {
      //             booking: null,
      //             cars: []
      //         }
      //     });
      // }

      // const carIds = cars.map(car => car._id);

      // Find the first active booking for any of these cars
      // that is not yet journey complete
      // const booking = await Booking.find({
      //     carId: { $in: carIds },
      //     status: "Booked", // Only get bookings that are still booked
      //     isJourneyComplete: false,
      //     // Optional: Add date validation to ensure the booking is current
      //     // fromDate: { $lte: new Date() }, // Journey should have started
      //     // toDate: { $gte: new Date() } // Journey should not have ended
      // })
      const booking = await Booking.find({
        driverId: req.driverId,
        status: "Booked", // Only get bookings that are still booked
        isJourneyComplete: false,
      })
        .populate({
          path: "customerId",
          select: "name email mobile",
        })
        .populate({
          path: "carId",
          select: "name company model image fuelType",
        })
        .sort({ createdAt: -1 }); // Get the most recent booking first

      return res.json({
        status: true,
        data: {
          bookings: booking || null,
          // cars
        },
      });
    } catch (error) {
      console.error("Get booking data to start journey error:", error);
      return res.status(500).json({
        status: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Get bookings by customer ID
  getBookingsByCustomer: async (req, res) => {
    try {
      const { customerId } = req.params;
      const bookings = await Booking.find({ customerId })
        .populate("carId")
        .populate("customerId");

      res.status(200).json(bookings);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error fetching customer bookings",
          error: error.message,
        });
    }
  },

  // Get bookings by car ID
  getBookingsByCar: async (req, res) => {
    try {
      const { carId } = req.params;
      const bookings = await Booking.find({ carId })
        .populate("carId")
        .populate("customerId");

      res.status(200).json(bookings);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching car bookings", error: error.message });
    }
  },

  // Update booking
  updateBooking: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if car exists
      if (updates.carId) {
        const car = await Car.findById(updates.carId);
        if (!car) {
          return res.status(404).json({ message: "Car not found" });
        }
        // if (!car.driverId || car.driverId == "") {
        //     return res.status(404).json({ message: "Selected Car Don't have driver" });
        // }

        // updates.driverId = car.driverId;
      }

      const booking = await Booking.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      })
        .populate("carId")
        .populate("customerId");

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res
        .status(200)
        .json({ message: "Booking updated successfully", booking });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating booking", error: error.message });
    }
  },

  // Cancel booking
  cancelBooking: async (req, res) => {
    try {
      const { id } = req.params;

      const booking = await Booking.findByIdAndUpdate(
        id,
        { status: "Cancelled" },
        { new: true },
      )
        .populate("carId")
        .populate("customerId");

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res
        .status(200)
        .json({ message: "Booking cancelled successfully", booking });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error cancelling booking", error: error.message });
    }
  },

  // Mark journey as complete
  completeJourney: async (req, res) => {
    try {
      const { id } = req.params;

      const booking = await Booking.findByIdAndUpdate(
        id,
        { isJourneyComplete: true, journeyStatus: "Completed" },
        { new: true },
      )
        .populate("carId")
        .populate("customerId");

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.status(200).json({ message: "Journey marked as complete", booking });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error completing journey", error: error.message });
    }
  },

  // Delete booking
  deleteBooking: async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await Booking.findByIdAndDelete(id);

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error deleting booking", error: error.message });
    }
  },

  // Check car availability
  checkAvailability: async (req, res) => {
    try {
      const { carId, fromDate, toDate } = req.body;

      const existingBooking = await Booking.findOne({
        carId,
        status: "Booked",
        $or: [{ fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }],
      });

      res.status(200).json({
        available: !existingBooking,
        message: existingBooking ? "Car is not available" : "Car is available",
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error checking availability", error: error.message });
    }
  },

  // Get active bookings
  getActiveBookings: async (req, res) => {
    try {
      const bookings = await Booking.find({
        status: "Booked",
        isJourneyComplete: false,
      })
        .populate("carId")
        .populate("customerId");

      res.status(200).json(bookings);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error fetching active bookings",
          error: error.message,
        });
    }
  },
};

module.exports = BookingController;
