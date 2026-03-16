const express = require("express");
const router = express.Router();
const projectCtrl = require("../controllers/projectController");
const auth = require("../middleware/auth.middleware"); // Your JWT auth middleware

router.post("/create", auth, projectCtrl.createProject);          // Create
router.get("/my-projects", auth, projectCtrl.getMyProjects);      // Specific user projects
router.get("/feed", auth, projectCtrl.getGlobalFeed);             // Global swappable feed
router.post("/request", auth, projectCtrl.sendRequest);           // Send join request
router.patch("/request/:id", auth, projectCtrl.updateRequestStatus); // Accept / reject request
router.post("/pass", auth, projectCtrl.passProject);              // Pass / skip project
router.get("/owner-requests", auth, projectCtrl.getOwnerRequests);// Requests for owner
router.get("/details/:id", auth, projectCtrl.getProjectById);     // Specific project data

module.exports = router;