const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const videoController = require('../controllers/videocontroller');
const auth = require("../middleware/auth.middleware");

// UPDATED: Accept both 'video' and 'thumbnail' files


router.get('/all', videoController.getAllVideos);

// Get all videos latest to old (requires auth)
router.get('/all-latest', auth, videoController.getAllVideosLatest);

// Get videos by course (requires auth)
router.get('/course/:course_id', videoController.getVideosByCourse);
// Get videos by User ID
router.get('/user/:user_id', videoController.getVideosByUserId);
router.post('/view-update', auth, videoController.updateVideoView);
// GET request: /api/videos/views/123
router.get('/views/:video_id', videoController.getVideoViews);


router.get('/users/:user_id/total-views', videoController.getUserTotalViews);

// Route for getting suggestions for a specific user
router.get('/suggestions/:user_id', videoController.getSuggestedVideos);

// DELETE request: /api/videos/delete/45
// Note: 'auth' middleware use karein taaki sirf logged-in user delete kar sake
router.delete('/delete/:video_id', auth, videoController.deleteVideo);

router.post(
  '/:user_id', 
  upload.fields([
    { name: 'video', maxCount: 1 }, 
    { name: 'thumbnail', maxCount: 1 }
  ]), 
  videoController.uploadVideo
);

module.exports = router;