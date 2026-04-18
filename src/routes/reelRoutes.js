const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const upload = require('../middleware/uploadMiddleware');
const auth = require('../middleware/auth.middleware');

// --- EXISTING ROUTES ---

// POST /api/reels (upload reel + optional thumb)
router.post('/', auth, upload.fields([
  { name: 'reel', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), reelController.createReel);

// GET /api/reels/feed
router.get('/feed', auth, reelController.getReelsFeed); // Added auth to check if 'I' liked the reels

// GET /api/reels/my (auth required)
router.get('/my', auth, reelController.getMyReels);

router.post('/:id/view', auth, reelController.updateReelView);

// Get specific reel view stats (Public)
router.get('/:id/views', reelController.getReelViews);

// Bina token wala route
router.get('/user/:userId', reelController.getReelsByUserId);


// --- NEW LIKE & COMMENT ROUTES ---

// Toggle Like (Like/Unlike)
// POST /api/reels/:id/like
router.post('/:id/like', auth, reelController.toggleLikeReel);

// Add a Comment
// POST /api/reels/:id/comment
router.post('/:id/comment', auth, reelController.addComment);

// Get all comments for a specific reel
// GET /api/reels/:id/getcomments
router.get('/:id/getcomments', reelController.getReelComments);

router.delete('/delete/:id', auth, reelController.deleteReel);

module.exports = router;