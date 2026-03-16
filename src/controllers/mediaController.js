const pool = require("../config/db");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

const uploadsFolder = path.resolve(__dirname, "../../uploads");

// 1. CREATE POST (Supports Video + Manual/Auto Thumbnail)
exports.createPost = async (req, res) => {
  const user_id = req.user.user_id;
  const { caption } = req.body;

  if (!req.files || !req.files['media']) {
    return res.status(400).json({ message: "Media file (image or video) is required" });
  }

  const mediaFile = req.files['media'][0];
  const manualThumb = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

  const media_url = `/uploads/${mediaFile.filename}`;
  const isVideo = mediaFile.mimetype.startsWith("video");
  const media_type = isVideo ? "video" : "image";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const postResult = await client.query(
      `INSERT INTO media_posts (user_id, caption, media_url, media_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, caption, media_url, media_type]
    );
    const newPost = postResult.rows[0];

    if (isVideo) {
      if (manualThumb) {
        // Option A: Use User-Uploaded Thumbnail
        const thumbUrl = `/uploads/${manualThumb.filename}`;
        await client.query(
          `INSERT INTO video_metadata (post_id, thumbnail_url, processing_status)
           VALUES ($1, $2, $3)`,
          [newPost.post_id, thumbUrl, 'completed']
        );
      } else {
        // Option B: Auto-Generate Thumbnail using FFmpeg
        const thumbFileName = `thumb-${Date.now()}.jpg`;
        const thumbUrl = `/uploads/${thumbFileName}`;

        ffmpeg(mediaFile.path)
          .screenshots({
            timestamps: ["00:00:01"],
            filename: thumbFileName,
            folder: uploadsFolder,
            size: "320x240",
          })
          .on("end", async () => {
            await pool.query(
              `INSERT INTO video_metadata (post_id, thumbnail_url, processing_status)
               VALUES ($1, $2, $3)`,
              [newPost.post_id, thumbUrl, 'completed']
            );
          })
          .on("error", (err) => console.error("FFmpeg Auto-Thumb Error:", err));
      }
    }

    await client.query("COMMIT");
    res.status(201).json(newPost);
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// 2. GET GLOBAL FEED
exports.getFeed = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, v.thumbnail_url, vs.view_count 
       FROM media_posts m 
       LEFT JOIN video_metadata v ON m.post_id = v.post_id 
       LEFT JOIN video_stats vs ON m.post_id = vs.post_id
       ORDER BY m.created_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. GET USER POSTS (Using Token)
exports.getMyPosts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, v.thumbnail_url, vs.view_count 
       FROM media_posts m 
       LEFT JOIN video_metadata v ON m.post_id = v.post_id 
       LEFT JOIN video_stats vs ON m.post_id = vs.post_id
       WHERE m.user_id = $1 
       ORDER BY m.created_date DESC`,
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. LIKE / UNLIKE POST
exports.toggleLike = async (req, res) => {
  const user_id = req.user.user_id;
  const { postId } = req.params;

  try {
    // simple like table stored inside video_stats is overkill; assume separate table not yet defined
    // For now just acknowledge – extend later with real table if needed
    res.status(501).json({ error: "Likes not fully implemented in DB yet" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. UPDATE VIEW COUNT & WATCH TIME
exports.updateWatchStats = async (req, res) => {
  const { postId } = req.params;
  const { watched_seconds } = req.body;

  const increment = Number(watched_seconds) || 0;

  try {
    await pool.query(
      `
      INSERT INTO video_stats (post_id, view_count, total_watch_seconds)
      VALUES ($1, 1, $2)
      ON CONFLICT (post_id) DO UPDATE
        SET view_count = video_stats.view_count + 1,
            total_watch_seconds = video_stats.total_watch_seconds + EXCLUDED.total_watch_seconds
      `,
      [postId, increment]
    );

    res.json({ message: "Watch stats updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. DELETE POST (Secure + File Cleanup)
exports.deletePost = async (req, res) => {
  const { postId } = req.params;
  const user_id = req.user.user_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const postCheck = await client.query(
      "SELECT media_url FROM media_posts WHERE post_id = $1 AND user_id = $2",
      [postId, user_id]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: "Post not found or unauthorized" });
    }

    const thumbCheck = await client.query(
      "SELECT thumbnail_url FROM video_metadata WHERE post_id = $1",
      [postId]
    );

    const mediaUrl = postCheck.rows[0].media_url;
    const thumbUrl = thumbCheck.rows[0]?.thumbnail_url;

    // Database Deletion
    await client.query("DELETE FROM video_metadata WHERE post_id = $1", [postId]);
    await client.query("DELETE FROM media_posts WHERE post_id = $1", [postId]);

    // Physical File Deletion
    const deleteFile = (url) => {
      if (url) {
        const fileName = url.split('/').pop();
        const filePath = path.join(uploadsFolder, fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    };

    deleteFile(mediaUrl);
    deleteFile(thumbUrl);

    await client.query("COMMIT");
    res.json({ message: "Post and files deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};