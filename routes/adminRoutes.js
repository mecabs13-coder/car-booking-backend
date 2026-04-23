const express = require('express');
const DriverController = require('../controller/DriverController');
const { singleUpload, twoUploads } = require('../config/imageUploder');
const CarController = require('../controller/CarController');
const JourneyLogController = require('../controller/JourneyLogController');
const FuelLogController = require('../controller/FuelLogController');
const BookingController = require('../controller/BookingController');
const CustomerController = require('../controller/CustomerController');
const authenticateToken = require('../middleware/authenticateToken');
const CarPerformanceController = require('../controller/CarPerformanceController');
const DashboardController = require('../controller/DashboardController');

const router = express.Router();

router.use(authenticateToken)


router.get("/dashboard/admin", DashboardController.AdminDashboard);
router.get("/dashboard/driver", DashboardController.DriverDashboard);

router.get("/customers/stats", CustomerController.getCustomerStats);
router.get("/customers", CustomerController.getCustomers);
router.get("/customers/:id", CustomerController.getCustomerById);
router.post("/customers/", singleUpload("customers"), CustomerController.createCustomer);
router.put("/customers/:id", singleUpload("customers"), CustomerController.updateCustomer);
router.patch("/customers/:id/status", CustomerController.updateCustomerStatus);
router.delete("/customers/:id", CustomerController.softDeleteCustomer);
router.patch("/customers/:id/restore", CustomerController.restoreCustomer);
router.delete("/customers/:id/permanent", CustomerController.permanentDeleteCustomer);


router.get("/drivers", DriverController.getDrivers)
// router.post('/drivers', twoUploads('drivers'), DriverController.createDriver);
router.post('/drivers', twoUploads('drivers', { image: 1, documentImage: 1 }), DriverController.createDriver);
router.get('/drivers/:id/edit', DriverController.getDriverById);
// router.put('/drivers/:id/update', twoUploads('drivers'), DriverController.updateDriver);
router.put('/drivers/:id/update', twoUploads('drivers', { image: 1, documentImage: 1 }), DriverController.updateDriver);
router.delete('/drivers/:id/delete', DriverController.deleteDriver);
router.delete('/drivers/:id/status', DriverController.updateDriverStatus);
router.delete('/drivers/:id/password', DriverController.updateDriverStatus);
router.get('/drivers/available/get', DriverController.getAvailableDrivers);


router.get('/cars', CarController.getAllCars);
router.get('/cars/available/get', CarController.getCars);
router.get('/cars/:id/edit', CarController.getCarById);
router.post('/cars', singleUpload('cars'), CarController.createCar);
router.put('/cars/:id/update', singleUpload('cars'), CarController.updateCar);
router.patch('/cars/:id/status', CarController.carStatusUpdate);
router.delete('/cars/:id/delete', CarController.deleteCar);
router.get('/cars/:driverId/driver', CarController.getCarsByDriver);
router.patch("/cars/:id/restore", CarController.restoreCustomer);


router.post('/journey-logs/start', singleUpload('journey-logs', 'odometerImage'), JourneyLogController.startJourney);
router.put('/journey-logs/:id/end', singleUpload('journey-logs', 'odometerImage'), JourneyLogController.endJourney);
router.get('/journey-logs', JourneyLogController.getAllJourneyLogs);
router.get('/journey-logs/:id', JourneyLogController.getJourneyLogById);
router.get('/journey-logs/booking/:bookingId', JourneyLogController.getJourneyLogsByBooking);
// router.put('/journey-logs/:id', twoUploads('journey-logs'), JourneyLogController.updateJourneyLog);
router.put('/admin-journey-logs/:id', twoUploads('journey-logs', { startImage: 1, endImage: 1 }), JourneyLogController.updateJourneyLog);
router.delete('/admin-journey-logs/:id', JourneyLogController.deleteJourneyLog);
router.get('/journey-logs/statistics', JourneyLogController.getJourneyStatistics);

router.get('/journey/start', BookingController.getBookingDataToStartjourney);
router.get('/journey/status-check', JourneyLogController.checkDriverJourneyStatus);

// Fuel Log routes
// router.post('/fuel-logs', twoUploads('fuel-logs'), FuelLogController.createFuelLog);
router.post('/fuel-logs', twoUploads('fuel-logs', { odometerImage: 1, fuelBillImage: 1 }), FuelLogController.createFuelLog);
router.get('/fuel-logs', FuelLogController.getAllFuelLogs);
router.get('/fuel-logs/:id', FuelLogController.getFuelLogById);
router.get('/fuel-logs/car/:carId', FuelLogController.getFuelLogsByCar);
// router.put('/fuel-logs/:id', twoUploads('fuel-logs'), FuelLogController.updateFuelLog);
router.put('/admin-fuel-logs/:id', twoUploads('fuel-logs', { odometerImage: 1, fuelBillImage: 1 }), FuelLogController.updateFuelLog);
router.delete('/admin-fuel-logs/:id', FuelLogController.deleteFuelLog);
router.get('/fuel-logs/report', FuelLogController.getFuelReport);
router.get('/fuel-logs/:carId/efficiency', FuelLogController.getFuelEfficiency);


router.get('/booking', BookingController.getAllBookings);
router.get('/booking/:id/edit', BookingController.getBookingById);
router.post('/booking', BookingController.createBooking);
router.put('/booking/:id/update', BookingController.updateBooking);
router.patch('/booking/:id/cancel', BookingController.cancelBooking);
router.delete('/booking/:id/delete', BookingController.deleteBooking);

// Car Details Routes
router.get("/car-performance/details", CarPerformanceController.carDetails);
router.get("/car-performance/:carId/detailed-report", CarPerformanceController.getCarDetailedReport);

module.exports = router;