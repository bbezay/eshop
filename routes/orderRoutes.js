const { Router } = require('express');
const { placeOrder, getOrders, getOrderById, getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

const router = Router();

router.post('/', authenticate, placeOrder);
router.get('/admin/all', authenticate, authorizeAdmin, getAllOrders);
router.put('/:id/status', authenticate, authorizeAdmin, updateOrderStatus);
router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrderById);

module.exports = router;
