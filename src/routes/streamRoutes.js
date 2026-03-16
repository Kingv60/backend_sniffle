const express = require("express");
const router = express.Router();
const streamController = require("../controllers/streamController");
const authMiddleware = require("../middleware/auth.middleware");

// 1. Host starts a live stream
// POST /api/streams/start
router.post("/start", authMiddleware, streamController.startStream);

// 2. Viewer joins a live stream (DB record)
// POST /api/streams/join
router.post("/join", authMiddleware, streamController.joinStream);

// 3. Host ends a live stream
// PATCH /api/streams/end/:streamId
router.patch("/end/:streamId", authMiddleware, streamController.endStream);

module.exports = router;