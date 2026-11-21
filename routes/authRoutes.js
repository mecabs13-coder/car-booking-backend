const express = require('express');
const UserController = require('../controller/UserController');
const CarController = require('../controller/CarController');

const router = express.Router();
router.get('/test', UserController.TestAPI);


router.get('/cars', CarController.getCars);


router.post('/admin-login', UserController.adminLogin);
router.post('/login', UserController.driverLogin);

router.post('/forget-password', UserController.forgetPassword);


module.exports = router;