const { Router } = require('express');
const { check } = require('../controllers/healthController');

const router = Router();
router.get('/', check);

module.exports = router;
