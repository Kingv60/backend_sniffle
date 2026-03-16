const express = require('express');
const router = express.Router();

const { searchUsers } = require('../controllers/userController');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/search', authenticateToken, searchUsers);

module.exports = router;