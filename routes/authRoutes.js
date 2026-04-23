const express = require('express');
const UserController = require('../controller/UserController');

const router = express.Router();
router.get('/test', UserController.TestAPI);


router.post('/admin-login', UserController.adminLogin);
router.post('/login', UserController.driverLogin);



module.exports = router;