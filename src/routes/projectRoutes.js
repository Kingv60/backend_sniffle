const express = require("express");
const router = express.Router();
const projectCtrl = require("../controllers/projectController");
const auth = require("../middleware/auth.middleware");

// --- CREATE & OWNERSHIP ---
router.post("/create", auth, projectCtrl.createProject);          // Create a new project
router.get("/my-projects", auth, projectCtrl.getMyProjects);      // Projects created by me

// --- FEED & DISCOVERY ---
router.get("/feed", auth, projectCtrl.getGlobalFeed);             // Discovery feed (with is_liked & likes_count)
router.get("/liked", auth, projectCtrl.getLikedProjects);         // Projects I have liked

// --- INTERACTIONS (Swiping Logic) ---
router.post("/toggle-like", auth, projectCtrl.toggleLikeProject); // Swipe Right / Heart Button
router.post("/discard", auth, projectCtrl.discardProject);       // Swipe Left / Cross Button

// --- JOIN REQUESTS (Management) ---
// Note: If you still use the 'request' table for formal applications, keep these:
router.patch("/request/:id", auth, projectCtrl.updateRequestStatus); // Accept/Reject a collaborator
router.get("/owner-requests", auth, projectCtrl.getOwnerRequests);   // See applicants for my projects

// --- PROJECT DETAILS & CHAT ---
router.get("/details/:id", auth, projectCtrl.getProjectById);      // Project info (with is_liked)
router.get("/details/:id/chat", auth, projectCtrl.getProjectChat); // Get chat group & participants

router.get("/liked", auth, projectCtrl.getLikedProjects);    
router.post("/request", auth, projectCtrl.sendRequest);      // Projects I have liked

module.exports = router;