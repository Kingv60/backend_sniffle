const express = require("express");
const cors = require("cors");

// Routes
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profileRoutes");
const messageRoutes = require("./routes/messageRoutes");
const mediaRoutes = require("./routes/mediaRoutes"); 
const userRoutes = require('./routes/userRoutes');
const otherProfileRoutes = require("./routes/otherprofileRoutes");
const projectRoutes = require("./routes/projectRoutes");
const courseRoutes = require("./routes/courseRoutes");
const app = express();

// Middlewarecls
app.use(cors());
app.use(express.json()); // to parse JSON requests
app.use(express.urlencoded({ extended: true })); // in case form-urlencoded is used

// Static folder for uploaded files
app.use("/uploads", express.static("uploads"));

// Test route
app.get("/", (req, res) => {
  res.json({ message: "SkillConnect API is running 🚀" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/media", mediaRoutes); 
app.use("/api/messages", messageRoutes);
app.use('/api/users', userRoutes);
app.use("/api/other-profile", otherProfileRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/courses", courseRoutes);
module.exports = app;