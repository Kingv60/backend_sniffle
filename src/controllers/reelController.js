const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { getUploadUrl, removeLocalUpload } = require("../utils/uploadHelpers");

// 1. Create Reel (POST /api/reels)
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

// 2. Get Reels Feed (Main Feed with Like/Comment counts)
exports.getReelsFeed = async (req, res) => {
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

// 3. Get My Reels
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

// 4. Get Reels by Specific User ID (Bina Token ke)
exports.getReelsByUserId = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.*, up.avatar_url,
        (SELECT COUNT(*) FROM reelviews rv WHERE rv.reelid = r.reelid AND rv.watchedseconds >= 10) AS views
       FROM reels r
       LEFT JOIN user_profile up ON r.userid = up.user_id
       WHERE r.userid = $1
       ORDER BY r.createdat DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Update Reel View
exports.updateReelView = async (req, res) => {
  const reelid = req.params.id;
  const viewerid = req.user.user_id;
  const { watchedseconds = 1 } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO reelviews (reelid, viewerid, watchedseconds)
       VALUES ($1, $2, $3)
       ON CONFLICT (reelid, viewerid)
       DO UPDATE SET watchedseconds = reelviews.watchedseconds + EXCLUDED.watchedseconds
       RETURNING *`,
      [reelid, viewerid, watchedseconds]
    );
    res.json({ message: 'View updated', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Get View Details
exports.getReelViews = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total_views,
        COUNT(CASE WHEN watchedseconds >= 10 THEN 1 END) AS valid_views,
        COALESCE(SUM(watchedseconds), 0) AS total_watch_time
       FROM reelviews WHERE reelid = $1`,
      [id]
    );
    res.json(result.rows[0] || { total_views: 0, valid_views: 0, total_watch_time: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Toggle Like
exports.toggleLikeReel = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;
  try {
    const checkLike = await pool.query('SELECT * FROM reel_likes WHERE reelid = $1 AND user_id = $2', [id, user_id]);
    if (checkLike.rows.length > 0) {
      await pool.query('DELETE FROM reel_likes WHERE reelid = $1 AND user_id = $2', [id, user_id]);
      return res.json({ message: 'Unliked', liked: false });
    } else {
      await pool.query('INSERT INTO reel_likes (reelid, user_id) VALUES ($1, $2)', [id, user_id]);
      return res.json({ message: 'Liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 8. Comments
exports.addComment = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;
  const { comment_text } = req.body;
  if (!comment_text) return res.status(400).json({ message: "Comment cannot be empty" });
  try {
    const result = await pool.query('INSERT INTO reel_comments (reelid, user_id, comment_text) VALUES ($1, $2, $3) RETURNING *', [id, user_id, comment_text]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReelComments = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT rc.*, u.name, up.avatar_url FROM reel_comments rc
       JOIN users u ON rc.user_id = u.user_id
       LEFT JOIN user_profile up ON u.user_id = up.user_id
       WHERE rc.reelid = $1 ORDER BY rc.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 9. Delete Reel
exports.deleteReel = async (req, res) => {
  const reelid = req.params.id;
  const userid = req.user.user_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reelCheck = await client.query('SELECT reelurl FROM reels WHERE reelid = $1 AND userid = $2', [reelid, userid]);
    if (reelCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Not authorized or reel not found" });
    }
    const reelPath = reelCheck.rows[0].reelurl;
    await client.query('DELETE FROM reels WHERE reelid = $1', [reelid]);
    await client.query('COMMIT');
    const absolutePath = path.join(__dirname, '../../', reelPath);
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};
