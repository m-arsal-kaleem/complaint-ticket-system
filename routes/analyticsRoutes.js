const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);
router.use(authController.restrictTo('admin'));

router.get('/', analyticsController.getAdminAnalytics);

module.exports = router;
