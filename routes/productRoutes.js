const { Router } = require('express');
const { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');
const { upload, processImage } = require('../middleware/uploadMiddleware');

const router = Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', authenticate, authorizeAdmin, upload.single('image'), processImage, createProduct);
router.put('/:id', authenticate, authorizeAdmin, upload.single('image'), processImage, updateProduct);
router.delete('/:id', authenticate, authorizeAdmin, deleteProduct);

module.exports = router;
