const pool = require("../config/db");
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { getUploadUrl, removeLocalUpload, isLocalUpload } = require("../utils/uploadHelpers");
const { cloudinary } = require("../config/cloudinary");

/**
 * 1. CREATE POST
 * Requirement: Token {caption, media, location}
 */
const createPost = async (req, res) => {
    const { caption, location } = req.body;
    const userId = req.user.user_id;

    if (!req.file) {
        return res.status(400).json({ error: "No media file uploaded." });
    }

    const fullPath = req.file.path;
    const dbPath = getUploadUrl(req.file);
    const isVideo = req.file.mimetype.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'image';
    const isLocalFile = isLocalUpload(req.file);

    try {
        let duration = 0;

        if (isVideo && isLocalFile) {
            console.log("🎥 Processing video duration for:", fullPath);
            try {
                duration = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(fullPath, (err, metadata) => {
                        if (err) {
                            console.error("❌ FFprobe Error:", err);
                            resolve(0);
                        } else {
                            resolve(metadata.format.duration || 0);
                        }
                    });
                });

                if (duration > 60) {
                    removeLocalUpload(req.file);
                    return res.status(400).json({ error: "Videos cannot exceed 60 seconds." });
                }
            } catch (ffmpegErr) {
                console.warn("⚠️ FFmpeg not found, skipping duration check.");
                duration = 0;
            }
        }

        const result = await pool.query(
            `INSERT INTO posts (user_id, caption, location, media_url, media_type, duration_seconds) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [userId, caption, location, dbPath, mediaType, Math.round(duration)]
        );

        console.log("✅ Post created successfully");
        res.status(201).json({ success: true, post: result.rows[0] });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        // Clean up uploaded local file if DB insert fails
        removeLocalUpload(req.file);
        res.status(500).json({ error: "Server error", details: err.message });
    }
};
/**
 * 2. GET MY POSTS
 */
const getMyPosts = async (req, res) => {
    const userId = req.user.user_id;
    try {
        const result = await pool.query(`
            SELECT 
                p.post_id, p.caption, p.media_url AS file, p.user_id AS "User id", up.username,up.avatar_url,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.post_id) AS comment,
                p.created_at AS createddate, p.user_id AS created_by
            FROM posts p
            JOIN user_profile up ON p.user_id = up.user_id
            WHERE p.user_id = $1 AND NOT p.is_archived
            ORDER BY p.created_at DESC
        `, [userId]);
        res.json({ posts: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET POSTS BY USER ID (For Other Person's Profile)
 * Requirement: userId in params
 */
const getPostsByUserId = async (req, res) => {
    const { userId } = req.params; // The profile we are looking at
    const loggedInUserId = req.user.user_id; // The person currently using the app

    try {
        const result = await pool.query(`
            SELECT 
                p.post_id, 
                p.caption, 
                p.media_url AS file, 
                p.media_type,
                p.user_id, 
                up.username, 
                up.avatar_url,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.post_id) AS comments,
                p.created_at AS createddate,
                EXISTS (
                    SELECT 1 FROM post_likes 
                    WHERE post_id = p.post_id AND user_id = $2
                ) AS is_liked
            FROM posts p
            LEFT JOIN user_profile up ON p.user_id = up.user_id
            WHERE p.user_id = $1 
            ORDER BY p.created_at DESC
        `, [userId, loggedInUserId]);

        res.json({ posts: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Server error", details: err.message });
    }
};

/**
 * 3. GET GLOBAL FEED
 */
const getFeed = async (req, res) => {
    const userId = req.user.user_id;

    try {
        const result = await pool.query(`
            SELECT 
                p.post_id,
                p.caption,
                p.media_url AS file,
                p.media_type,
                p.user_id,
                up.username,
                up.avatar_url,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.post_id) AS comments,
                p.created_at AS createddate,
                -- Check if current user liked this post
                EXISTS (
                    SELECT 1 FROM post_likes 
                    WHERE post_id = p.post_id AND user_id = $1
                ) AS is_liked,
                CASE 
                    WHEN vv.user_id IS NULL THEN false
                    ELSE true
                END AS is_viewed
            FROM posts p
            JOIN user_profile up ON p.user_id = up.user_id
            LEFT JOIN video_views vv 
                ON vv.post_id = p.post_id 
                AND vv.user_id = $1
            WHERE NOT p.is_archived
            ORDER BY p.created_at DESC
            LIMIT 50
        `, [userId]);

        res.json({ posts: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * 4. DELETE POST
 */
const deletePost = async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.user_id;
    try {
        const result = await pool.query(
            'DELETE FROM posts WHERE post_id = $1 AND user_id = $2 RETURNING media_url',
            [postId, userId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Post not found' });

        const mediaPath = path.join(__dirname, '..', '..', result.rows[0].media_url);
        if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);

        res.json({ success: true, message: 'Post deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * 5. LIKE/UNLIKE (Interaction)
 */
const toggleLike = async (req, res) => {
    const { post_id } = req.body;
    const userId = req.user.user_id;
    try {
        // Check if like exists
        const check = await pool.query(
            "SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2", 
            [post_id, userId]
        );

        if (check.rows.length > 0) {
            // Already liked, so UNLIKE
            await pool.query(
                "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", 
                [post_id, userId]
            );
            return res.json({ success: true, isLiked: false });
        } else {
            // Not liked yet, so LIKE
            await pool.query(
                "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", 
                [post_id, userId]
            );
            return res.json({ success: true, isLiked: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * 6. ADD COMMENT
 */
const addComment = async (req, res) => {
    const { post_id, comment_text } = req.body;
    const userId = req.user.user_id;
    try {
        const result = await pool.query(
            "INSERT INTO post_comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING *",
            [post_id, userId, comment_text]
        );
        res.status(201).json({ success: true, comment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET COMMENTS FOR A SPECIFIC POST
 */
const getCommentsByPostId = async (req, res) => {
    const { postId } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                pc.comment_id, 
                pc.comment_text, 
                pc.created_at, 
                pc.user_id, 
                up.username, 
                up.avatar_url
            FROM post_comments pc
            JOIN user_profile up ON pc.user_id = up.user_id
            WHERE pc.post_id = $1
            ORDER BY pc.created_at ASC
        `, [postId]);

        res.json({ comments: result.rows });
    } catch (err) {
        console.error("Error fetching comments:", err.message);
        res.status(500).json({ error: "Server error", details: err.message });
    }
};

// Remember to add getCommentsByPostId to your module.exports!

/**
 * 7. DELETE COMMENT
 */
const deleteComment = async (req, res) => {
    const { comment_id } = req.params;
    const userId = req.user.user_id;
    try {
        const result = await pool.query("DELETE FROM post_comments WHERE comment_id = $1 AND user_id = $2 RETURNING *", [comment_id, userId]);
        if (result.rowCount === 0) return res.status(403).json({ error: "Unauthorized" });
        res.json({ success: true, message: "Comment deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const markPostAsRead = async (req, res) => {
    const { post_id } = req.body;
    const userId = req.user.user_id;

    try {
        await pool.query(`
            INSERT INTO video_views (user_id, post_id, watched_seconds, last_watched_at)
            VALUES ($1, $2, 2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, post_id) 
            DO UPDATE SET last_watched_at = CURRENT_TIMESTAMP
        `, [userId, post_id]);

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { createPost, getMyPosts, getFeed, deletePost, toggleLike, addComment, deleteComment,getPostsByUserId,getCommentsByPostId, markPostAsRead };