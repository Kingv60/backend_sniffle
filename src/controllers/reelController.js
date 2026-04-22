const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { getUploadUrl, removeLocalUpload } = require("../utils/uploadHelpers");
// Create Reel (POST /api/reels)
exports.createReel = async (req, res) => {
  const userid = req.user.user_id;
  const { caption } = req.body;

  if (!req.files?.reel)
    return res.status(400).json({ message: 'Reel video required' });

  const reelFile = req.files.reel[0];
  const reelurl = getUploadUrl(reelFile);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reelResult = await client.query(
      `INSERT INTO reels (userid, caption, reelurl)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userid, caption, reelurl]
    );

    await client.query('COMMIT');

    res.status(201).json(reelResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');

    if (reelFile) removeLocalUpload(reelFile);

    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// Get Reels by Specific User ID (Bina Token ke)
exports.getReelsFeed = async (req, res) => {
  // Use optional chaining to handle guests if your middleware allows it
  const current_user_id = req.user?.user_id || 0; 

  try {
    const result = await pool.query(
      `SELECT r.*, u.name, up.avatar_url,
        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reelid = r.reelid) AS likes_count,
        (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reelid = r.reelid) AS comments_count,
        (SELECT COUNT(*) FROM reelviews rv WHERE rv.reelid = r.reelid AND rv.watchedseconds >= 10) AS views_count,
        EXISTS(SELECT 1 FROM reel_likes WHERE reelid = r.reelid AND user_id = $1) AS is_liked
       FROM reels r
       LEFT JOIN users u ON r.userid = u.user_id
       LEFT JOIN user_profile up ON r.userid = up.user_id
       ORDER BY r.createdat DESC
       LIMIT 50`,
      [current_user_id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get Reels Feed
exports.getReelsFeed = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.name, v.views
       FROM reels r
       LEFT JOIN users u ON r.userid = u.user_id
       LEFT JOIN (
          SELECT reelid, COUNT(*) as views
          FROM reelviews
          WHERE watchedseconds >= 10
          GROUP BY reelid
       ) v ON r.reelid = v.reelid
       ORDER BY r.createdat DESC
       LIMIT 50`
    );

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get My Reels
exports.getMyReels = async (req, res) => {
  const userid = req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT r.*, up.avatar_url
       FROM reels r
       LEFT JOIN user_profile up ON r.userid = up.user_id
       WHERE r.userid = $1
       ORDER BY r.createdat DESC`,
      [userid]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Update Reel View
// Update Reel View with Debug Logging
exports.updateReelView = async (req, res) => {
  const reelid = req.params.id;
  const viewerid = req.user.user_id;
  const { watchedseconds = 1 } = req.body;

  console.log(`🚀 View Triggered: Reel ${reelid} by User ${viewerid} (${watchedseconds}s)`);

  try {
    const result = await pool.query(
      `INSERT INTO reelviews (reelid, viewerid, watchedseconds)
       VALUES ($1, $2, $3)
       ON CONFLICT (reelid, viewerid)
       DO UPDATE SET watchedseconds = reelviews.watchedseconds + EXCLUDED.watchedseconds
       RETURNING *`,
      [reelid, viewerid, watchedseconds]
    );

    console.log(`📥 DB Response: Updated watch time to ${result.rows[0].watchedseconds}s`);
    res.json({ message: 'View updated', data: result.rows[0] });

  } catch (error) {
    console.error("❌ View Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get View Count and Details by Reel ID
exports.getReelViews = async (req, res) => {
  const { id } = req.params; // reelid

  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) AS total_views,
        COUNT(CASE WHEN watchedseconds >= 10 THEN 1 END) AS valid_views,
        COALESCE(SUM(watchedseconds), 0) AS total_watch_time
       FROM reelviews 
       WHERE reelid = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ total_views: 0, valid_views: 0, total_watch_time: 0 });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle Like/Unlike Reel
exports.toggleLikeReel = async (req, res) => {
  const { id } = req.params; // reelid
  const user_id = req.user.user_id;

  try {
    // Check if already liked
    const checkLike = await pool.query(
      'SELECT * FROM reel_likes WHERE reelid = $1 AND user_id = $2',
      [id, user_id]
    );

    if (checkLike.rows.length > 0) {
      // Unlike: Remove from likes table
      await pool.query(
        'DELETE FROM reel_likes WHERE reelid = $1 AND user_id = $2',
        [id, user_id]
      );
      return res.json({ message: 'Unliked', liked: false });
    } else {
      // Like: Add to likes table
      await pool.query(
        'INSERT INTO reel_likes (reelid, user_id) VALUES ($1, $2)',
        [id, user_id]
      );
      return res.json({ message: 'Liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Add Comment to Reel
exports.addComment = async (req, res) => {
  const { id } = req.params; // reelid
  const user_id = req.user.user_id;
  const { comment_text } = req.body;

  if (!comment_text) return res.status(400).json({ message: "Comment cannot be empty" });

  try {
    const result = await pool.query(
      `INSERT INTO reel_comments (reelid, user_id, comment_text) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [id, user_id, comment_text]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get Comments for a Reel
exports.getReelComments = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT rc.*, u.name, up.avatar_url 
       FROM reel_comments rc
       JOIN users u ON rc.user_id = u.user_id
       LEFT JOIN user_profile up ON u.user_id = up.user_id
       WHERE rc.reelid = $1
       ORDER BY rc.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get Reels Feed with Likes, Comments, Views Count and Whether "I" Liked It
exports.getReelsFeed = async (req, res) => {
  const current_user_id = req.user?.user_id || 0; // Optional: to check if "I" liked it

  try {
    const result = await pool.query(
      `SELECT r.*, u.name, up.avatar_url,
        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reelid = r.reelid) AS likes_count,
        (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reelid = r.reelid) AS comments_count,
        (SELECT COUNT(*) FROM reelviews rv WHERE rv.reelid = r.reelid AND rv.watchedseconds >= 10) AS views_count,
        EXISTS(SELECT 1 FROM reel_likes WHERE reelid = r.reelid AND user_id = $1) AS is_liked
       FROM reels r
       LEFT JOIN users u ON r.userid = u.user_id
       LEFT JOIN user_profile up ON r.userid = up.user_id
       ORDER BY r.createdat DESC
       LIMIT 50`,
      [current_user_id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Reel
exports.deleteReel = async (req, res) => {
  const reelid = req.params.id;
  const userid = req.user.user_id; // Token se user ID lega

  if (!reelid) {
    return res.status(400).json({ message: "Reel ID is required" });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Pehle check karein ki reel exist karti hai aur request karne wala banda uska owner hai
    const reelCheck = await client.query(
      'SELECT reelurl FROM reels WHERE reelid = $1 AND userid = $2',
      [reelid, userid]
    );

    if (reelCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Reel not found or you are not authorized to delete this reel" });
    }

    const reelPath = reelCheck.rows[0].reelurl;

    // 2. Database se reel delete karein 
    // (Note: Agar Foreign Keys ON DELETE CASCADE par hain, toh likes, comments, views automatically delete ho jayenge)
    await client.query('DELETE FROM reels WHERE reelid = $1', [reelid]);

    await client.query('COMMIT');

    // 3. Server se physical file delete karein
    const absolutePath = path.join(__dirname, '../../', reelPath); // Path set karein as per your structure
    
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`✅ File deleted: ${absolutePath}`);
    }

    res.status(200).json({ success: true, message: "Reel and associated file deleted successfully" });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Delete Reel Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};
