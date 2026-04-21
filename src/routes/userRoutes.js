const express = require('express');
const router = express.Router();

// 1. Pura controller object import karein (Destructuring hata kar)
const userController = require('../controllers/userController');

// 2. Middleware import karein
const authenticateToken = require('../middleware/auth.middleware');

// ================= SEARCH USERS =================
// Ab aap userController.searchUsers use karenge
router.get('/search', authenticateToken, userController.searchUsers);

// ================= SAVE FCM TOKEN =================
// Ab userController defined hai, toh ye error nahi dega
router.post("/update-fcm-token", authenticateToken, userController.updateFcmToken);
router.post('/logout', authenticateToken, userController.logout);

module.exports = router;
