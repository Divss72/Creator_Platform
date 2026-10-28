const { Router } = require('express');
const authRoutes = require('./auth.routes');
const creatorsRoutes = require('./creators.routes');
const contentRoutes = require('./content.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/creators', creatorsRoutes);
router.use('/content', contentRoutes);

module.exports = router;
