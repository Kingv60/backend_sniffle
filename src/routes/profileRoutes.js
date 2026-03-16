const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const upload = require("../middleware/uploadMiddleware");
const profileController = require("../controllers/profileController");

router.post(
  "/",
  authMiddleware,
  upload.single("avatar"), // upload avatar while creating profile
  profileController.createProfile
);

router.get(
  "/",
  authMiddleware,
  profileController.getMyProfile
);

router.put(
  "/",
  authMiddleware,
  upload.single("avatar"), // upload avatar while updating profile
  profileController.updateProfile
);

module.exports = router;