const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const auth = require("../middleware/auth.middleware");

// List courses
router.get("/", courseController.getCourses);

// Course details with lessons
router.get("/:id", courseController.getCourseById);

// Enroll in a course
router.post("/enroll", auth, courseController.enroll);

// Get my enrolled courses
router.get("/my-courses/list", auth, courseController.getMyCourses);

module.exports = router;