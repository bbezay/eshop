const { Router } = require('express');
const { register, login, softDeleteUser, toggleUserStatus, getProfile, updateProfile } = require('../controllers/authController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getProfile);
router.put('/me', authenticate, updateProfile);
router.delete('/users/:id', authenticate, authorizeAdmin, softDeleteUser);
router.patch('/users/:id/status', authenticate, authorizeAdmin, toggleUserStatus);

module.exports = router;
