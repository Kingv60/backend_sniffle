const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/uploadMiddleware");

// List courses
router.get("/", courseController.getCourses);

// ALL specific routes MUST come before parameterized /:id route
router.post("/enroll", auth, courseController.enroll);
router.get("/my-courses/list", auth, courseController.getMyCourses);
router.get("/my-created-courses", auth, courseController.getMyCreatedCourses);
router.post('/create', auth, upload.single('thumbnail'), courseController.createCourse);
router.get("/user/:user_id", courseController.getCoursesByUserId);
router.get("/check-enrollment/:course_id", auth, courseController.checkEnrollment);

// Parameterized route MUST be LAST
router.get("/:id", courseController.getCourseById);

module.exports = router;