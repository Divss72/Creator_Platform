const { Router } = require('express');
const authRoutes = require('./auth.routes');
const creatorsRoutes = require('./creators.routes');
const contentRoutes = require('./content.routes');
const tiersRoutes = require('./tiers.routes');
const subscriptionsRoutes = require('./subscriptions.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/creators', creatorsRoutes);
router.use('/content', contentRoutes);
router.use('/tiers', tiersRoutes);
router.use('/subscriptions', subscriptionsRoutes);

module.exports = router;
