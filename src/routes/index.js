const { Router } = require('express');
const authRoutes = require('./auth.routes');
const creatorsRoutes = require('./creators.routes');
const contentRoutes = require('./content.routes');
const tiersRoutes = require('./tiers.routes');
const subscriptionsRoutes = require('./subscriptions.routes');
const notificationsRoutes = require('./notifications.routes');
const emailRoutes = require('./email.routes');
const contentController = require('../controllers/content.controller');
const optionalAuth = require('../middleware/optionalAuth');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/trending', optionalAuth, asyncHandler(contentController.getTrending));
router.use('/auth', authRoutes);
router.use('/creators', creatorsRoutes);
router.use('/content', contentRoutes);
router.use('/tiers', tiersRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/email', emailRoutes);

module.exports = router;
