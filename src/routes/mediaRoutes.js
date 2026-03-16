const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/auth.middleware");

// 1. Create a Post (Image or Video)
// Allow two files: one named "media" and one named "thumbnail"
router.post(
  "/upload",
  authMiddleware,
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]),
  mediaController.createPost
);

// 2. Get Media Feed (Public)
router.get("/feed", mediaController.getFeed);
   
// 3. NEW: Get Only MY Posts (Private - using Token)
// This must be added so the "Cannot GET /me" error goes away
router.get("/me", authMiddleware, mediaController.getMyPosts);

// DELETE: http://localhost:8000/api/media/delete/123
router.delete("/delete/:postId", authMiddleware, mediaController.deletePost);

// Update watch stats (view + seconds watched)
router.post(
  "/:postId/watch",
  authMiddleware,
  mediaController.updateWatchStats
);

module.exports = router;