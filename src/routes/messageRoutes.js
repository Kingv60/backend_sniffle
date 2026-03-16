const express = require("express");
const router = express.Router();
const controller = require("../controllers/messageController");
const auth = require("../middleware/auth.middleware");

router.post("/start", auth, controller.startConversation);
router.get("/chats", auth, controller.getUserChats);
router.get("/messages/:conversationId", auth, controller.getMessages);
router.post("/send", auth, controller.sendMessage);

module.exports = router;