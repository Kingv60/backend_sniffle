const express = require("express");
const cors = require("cors");
const path = require('path');

// App create FIRST
const app = express();

// Middleware FIRST
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Static uploads (ONCE ONLY)
app.use("/uploads", express.static("uploads"));

// Routes import AFTER app
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profileRoutes");
const messageRoutes = require("./routes/messageRoutes");
const mediaRoutes = require("./routes/mediaRoutes"); 
const userRoutes = require('./routes/userRoutes');
const postRoutes = require("./routes/postRoutes");
const otherProfileRoutes = require("./routes/otherprofileRoutes");
const projectRoutes = require("./routes/projectRoutes");
const courseRoutes = require("./routes/courseRoutes");
const videoRoutes = require("./routes/videoRoutes"); 
const reelRoutes = require("./routes/reelRoutes") // ONE TIME ONLY

// API Root Route (MANDATORY)
app.get("/api/", (req, res) => {
  res.json({ 
    message: "SkillConnect API is running 🚀",
    port: 8000,
    endpoints: ["/api/courses", "/api/videos", "/api/auth"]
  });
});

// API Routes (NO DUPLICATES)
app.use("/api/auth", authRoutes);
app.use("/api/other-profile", otherProfileRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/messages", messageRoutes);
app.use('/api/users', userRoutes);

app.use("/api/projects", projectRoutes);
app.use("/api/courses", courseRoutes);      // ONE TIME
app.use("/api/videos", videoRoutes);        // ONE TIME ONLY
app.use("/api/reels", reelRoutes);          // ONE TIME ONLY

// Error handling middleware (MUST be last)
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  console.error("Stack:", err.stack);

  // Handle multer/Cloudinary errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: "File too large. Maximum size is 500MB.",
      code: err.code
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
      code: err.code
    });
  }

  // Handle Cloudinary errors
  if (err.message && err.message.includes('file format')) {
    return res.status(400).json({
      error: "Unsupported file format. Please upload: JPG, PNG, GIF, SVG, MP4, or other common image/video formats.",
      code: "UNSUPPORTED_FORMAT"
    });
  }

  if (err.message && err.message.includes('cloudinary')) {
    return res.status(500).json({
      error: "Cloudinary upload failed. Please check your file and try again.",
      code: "CLOUDINARY_ERROR"
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    code: err.code || "INTERNAL_ERROR"
  });
});

module.exports = app;
