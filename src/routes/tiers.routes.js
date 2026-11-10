const { Router } = require('express');
const tiersController = require('../controllers/tiers.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(tiersController.listTiers));

module.exports = router;
