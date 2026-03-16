const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware"); // optional, but recommended

// ✅ Register & Login
router.post("/register", authController.register);
router.post("/login", authController.login);

// ✅ Delete user (rollback) - requires authentication
router.delete("/users/:userId", authMiddleware, authController.deleteUser);

module.exports = router;