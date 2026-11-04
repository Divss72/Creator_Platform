const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', requireAuth, asyncHandler(authController.getMe));

module.exports = router;
