const express = require("express");
const router = express.Router(); 
const verifyToken = require("../middleware/auth.middleware");
const upload = require("../middleware/uploadMiddleware");
const {
    createPost,
    getMyPosts,
    getPostsByUserId,
    getFeed,
    deletePost,
    toggleLike,
    addComment,
    deleteComment,
    getCommentsByPostId,
    markPostAsRead // <-- 1. Add this to your imports
} = require("../controllers/postMedia.controller");
router.post("/mediaPost/", verifyToken, upload.single("media"), createPost);
router.get("/mediaPost/my", verifyToken, getMyPosts);
router.get("/mediaPost/feed", verifyToken, getFeed);
router.delete("/mediaPost/delete/:id", verifyToken, deletePost);
router.get('/mediaPost/user/:userId', verifyToken, getPostsByUserId);

// --- Interaction & Comment Routes ---
router.post("/like", verifyToken, toggleLike);
router.post("/comment", verifyToken, addComment);
router.delete("/comment/:comment_id", verifyToken, deleteComment);
router.get("/mediaPost/comments/:postId", verifyToken, getCommentsByPostId);

// --- Mark Read Route ---
// 2. Call markPostAsRead directly (remove postMediaController prefix)
router.post('/mark-read', verifyToken, markPostAsRead);

module.exports = router;