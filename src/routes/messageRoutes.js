const express = require("express");
const router = express.Router();
const controller = require("../controllers/messageController");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/uploadMiddleware"); // Import your multer config

router.post("/start", auth, controller.startConversation);
router.get("/chats", auth, controller.getUserChats);
router.get("/messages/:conversationId", auth, controller.getMessages);

// Use upload.single("file") here. 
// "file" must match the key used in Flutter's MultipartRequest
router.post("/send", auth, upload.single("file"), controller.sendMessage);

router.post("/react", auth, controller.toggleReaction);

module.exports = router;