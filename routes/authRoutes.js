const express = require('express');
const UserController = require('../controller/UserController');
const CarController = require('../controller/CarController');
const SettingController = require('../controller/SettingController');

const router = express.Router();
router.get('/test', UserController.TestAPI);


router.get('/cars', CarController.getCars);


router.post('/admin-login', UserController.adminLogin);
router.post('/login', UserController.driverLogin);

router.post('/forget-password', UserController.forgetPassword);

router.get('/setting', SettingController.index);

// router.get("/profile", UserController.getProfile);

module.exports = router;