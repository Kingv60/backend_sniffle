const pool = require("../config/db");

// 1. Get the Full Profile (User info + Profile info)
const getOtherUserProfile = async (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      SELECT 
        u.user_id, 
        u.name, 
        u.email, 
        p.username, 
        p.skills, 
        p.bio, 
        p.role, 
        p.avatar_url AS avatar
      FROM users u
      LEFT JOIN user_profile p ON u.user_id = p.user_id
      WHERE u.user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = result.rows[0];

    // Convert comma-separated skills string into an Array for Flutter
    if (userData.skills) {
      userData.skills = userData.skills.split(',').map(s => s.trim());
    } else {
      userData.skills = [];
    }

    res.json(userData);
  } catch (err) {
    console.error("Error in getOtherUserProfile:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
};

// 2. Get User's Media/Videos
const getOtherUserVideos = async (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      SELECT 
        m.post_id, 
        m.caption, 
        m.media_url, 
        m.media_type,
        v.thumbnail_url, 
        v.created_at AS "createdAt"
      FROM media_posts m
      LEFT JOIN video_metadata v ON m.post_id = v.post_id
      WHERE m.user_id = $1 AND m.media_type = 'video'
      ORDER BY m.created_date DESC
    `;

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in getOtherUserVideos:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = { getOtherUserProfile, getOtherUserVideos };