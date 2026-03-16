const express = require("express");
const router = express.Router();
const { getOtherUserProfile, getOtherUserVideos } = require("../controllers/otherprofile");

// GET /api/other-profile/3
router.get("/:userId", getOtherUserProfile);

// GET /api/other-profile/videos/3
router.get("/videos/:userId", getOtherUserVideos);

module.exports = router;