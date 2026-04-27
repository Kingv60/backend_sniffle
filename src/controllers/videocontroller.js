const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { getUploadUrl, removeLocalUpload, isLocalUpload, isLocalUrl } = require('../utils/uploadHelpers');
const { cloudinary } = require('../config/cloudinary');
const { messaging } = require('../config/firebase');

// Create a simple thumbnail image (placeholder)
const createThumbnail = (filename) => {
  const uploadDir = path.join(__dirname, '../../uploads');
  const thumbPath = path.join(uploadDir, filename);

  const minimalJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD3, 0xFF, 0xD9
  ]);
  
  fs.writeFileSync(thumbPath, minimalJpeg);
  return thumbPath;
};

const sendPushNotification = async (tokens, notification, client = null) => {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    console.log("No FCM tokens to send notification");
    return;
  }

  try {
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = []; // Track dead tokens to remove from DB

    // Send to each token individually
    for (const token of tokens) {
      try {
        await messaging.send({
          token: token,
          notification: notification,
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channel_id: "course_updates",
            },
          },
        });
        successCount++;
      } catch (error) {
        console.error(`❌ FCM error for token: ${error.message}`);
        failureCount++;

        // If Firebase says token doesn't exist, mark it for deletion
        if (error.message.includes("Requested entity was not found") || 
            error.message.includes("Third party authentication error")) {
          invalidTokens.push(token);
        }
      }
    }

    console.log(`✅ Push sent: ${successCount} success, ${failureCount} failed out of ${tokens.length}`);

    // Remove invalid tokens from database
    if (invalidTokens.length > 0 && client) {
      try {
        await client.query(
          `UPDATE users SET fcm_token = NULL WHERE fcm_token = ANY($1::text[])`,
          [invalidTokens]
        );
        console.log(`🗑️  Removed ${invalidTokens.length} invalid FCM tokens from database`);
      } catch (dbError) {
        console.error("Error cleaning invalid tokens:", dbError.message);
      }
    }
  } catch (error) {
    console.error("❌ sendPushNotification error:", error);
  }
};
exports.uploadVideo = async (req, res) => {
  const { name, description, course_id } = req.body;
  const user_id = req.params.user_id;

  const videoFile = req.files && req.files['video'] ? req.files['video'][0] : null;
  const thumbFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

  if (!user_id) return res.status(400).json({ message: 'User ID is required' });
  if (!videoFile) return res.status(400).json({ message: 'Video file required' });
  if (!name) return res.status(400).json({ message: 'Name required' });

  const video_url = getUploadUrl(videoFile);
  const thumbnail_url = thumbFile
    ? getUploadUrl(thumbFile)
    : videoFile.eager?.[0]?.secure_url
      || (videoFile.public_id && cloudinary
        ? cloudinary.url(videoFile.public_id, {
            resource_type: 'video',
            format: 'jpg',
            secure: true,
            transformation: [
              { width: 320, height: 240, crop: 'thumb', gravity: 'south' },
            ],
          })
        : (isLocalUpload(videoFile)
            ? `/uploads/${path.basename(createThumbnail(`${Date.now()}-${path.parse(videoFile.filename).name}.jpg`))}`
            : null));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Video
    const videoResult = await client.query(
      `INSERT INTO course_videos (course_id, name, description, video_url, thumbnail_url, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [course_id && parseInt(course_id) > 0 ? course_id : null, name, description || '', video_url, thumbnail_url, user_id]
    );

    // 2. Fetch Course Name and Enrolled Users' FCM Tokens
    const enrollmentData = await client.query(
      `SELECT u.fcm_token, c.title as course_name 
       FROM course_enrollments e
       JOIN users u ON e.user_id = u.user_id
       JOIN courses c ON e.course_id = c.course_id
       WHERE e.course_id = $1 AND u.fcm_token IS NOT NULL`,
      [course_id]
    );

    console.log(`📢 Notification Debug:
      - Course ID: ${course_id}
      - Enrolled users found: ${enrollmentData.rows.length}
      - FCM Tokens: ${enrollmentData.rows.map(r => r.fcm_token).join(', ')}`);

    await client.query('COMMIT');

    res.status(201).json(videoResult.rows[0]);

    // 3. Trigger Notifications (Background)
    if (enrollmentData.rows.length > 0) {
      const tokens = enrollmentData.rows.map(row => row.fcm_token);
      const courseName = enrollmentData.rows[0].course_name;

      console.log(`🔔 Sending ${tokens.length} notifications for course: ${courseName}`);

      sendPushNotification(tokens, {
        title: `New Video in ${courseName}`,
        body: `New Lesson Uploaded: ${name}`
      }, client).catch(err => console.error("Notification Error:", err));
    } else {
      console.log("⚠️  No enrolled users with FCM tokens found");
    }

  } catch (err) {
    await client.query('ROLLBACK');
    if (videoFile) fs.unlinkSync(videoFile.path);
    if (thumbFile) fs.unlinkSync(thumbFile.path);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};


exports.updateVideoView = async (req, res) => {
  // 1. Log incoming request
 
  const { video_id, user_id, watched_seconds } = req.body; 

  if (!video_id || !user_id) {
    console.log("❌ Validation Failed: Missing video_id or user_id");
    return res.status(400).json({ 
      message: "video_id and user_id are both required in JSON body" 
    });
  }

  try {
  
    
    await pool.query(`
      INSERT INTO video_views (video_id, user_id, watched_seconds, last_watched_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT ON CONSTRAINT unique_user_video_view 
      DO UPDATE SET 
        watched_seconds = EXCLUDED.watched_seconds,
        last_watched_at = CURRENT_TIMESTAMP
    `, [video_id, user_id, watched_seconds || 0]);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total_views FROM video_views WHERE video_id = $1`,
      [video_id]
    );

    res.status(200).json({
      success: true,
      video_id: video_id,
      total_views: parseInt(countResult.rows[0].total_views),
      message: "View updated successfully"
    });

  } catch (error) {
    console.error("❌ Database Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};


// Get total views and watch details for a specific video
exports.getVideoViews = async (req, res) => {
    const { video_id } = req.params;

    if (!video_id) {
        return res.status(400).json({ success: false, message: "Video ID is required" });
    }

    try {
        // 1. Get total view count
        const countResult = await pool.query(
            'SELECT COUNT(*) as total_views FROM video_views WHERE video_id = $1',
            [video_id]
        );

        // 2. (Optional) Get individual user watch history for this video
        const detailsResult = await pool.query(
            'SELECT user_id, watched_seconds, last_watched_at FROM video_views WHERE video_id = $1',
            [video_id]
        );

        res.status(200).json({
            success: true,
            video_id: video_id,
            total_views: parseInt(countResult.rows[0].total_views),
            viewer_details: detailsResult.rows
        });

    } catch (error) {
        console.error("❌ Error fetching video views:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error while fetching views",
            error: error.message
        });
    }
};

exports.getVideosByUserId = async (req, res) => {
    const { user_id } = req.params; // The Creator
    const requester_id = req.query.requester_id; // The Viewer (from Flutter)

    if (!user_id || !requester_id) {
        return res.status(400).json({ success: false, message: "User ID and Requester ID are required" });
    }

    try {
        // We JOIN with your enrollment table (assuming it's called 'enrollments')
        // This creates a column 'is_enrolled' which is true if a match is found
        const result = await pool.query(
            `SELECT 
                v.*,
                CASE 
                    WHEN e.user_id IS NOT NULL THEN true 
                    ELSE false 
                END as is_enrolled
             FROM course_videos v
             LEFT JOIN course_enrollments e ON v.course_id = e.course_id AND e.user_id = $2
             WHERE v.user_id = $1 
             ORDER BY v.created_at DESC`, 
            [user_id, requester_id]
        );

        res.status(200).json(result.rows); 

    } catch (error) {
        console.error("❌ Error fetching videos:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all videos by time
exports.getAllVideos = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM course_videos ORDER BY created_at DESC'  // ← created_at fix
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get videos by course
exports.getVideosByCourse = async (req, res) => {
  const course_id = req.params.course_id;

  try {
    // We query course_videos directly since course_lessons is empty
    const result = await pool.query(
      `SELECT 
        video_id,
        name AS title,
        description,
        video_url,
        thumbnail_url,
        user_id AS uploaded_by,
        created_at
      FROM course_videos 
      WHERE course_id = $1
      ORDER BY created_at ASC`,
      [course_id]
    );

    res.json({
      success: true,
      course_id: parseInt(course_id),
      total_videos: result.rows.length,
      videos: result.rows
    });
  } catch (err) {
    console.error('Error fetching course videos:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get next course videos after the currently playing lesson
exports.getNextCourseVideoSuggestions = async (req, res) => {
  const { video_id } = req.params;
  const limit = 5;

  if (!video_id) {
    return res.status(400).json({
      success: false,
      message: 'Current video_id is required to fetch next course suggestions'
    });
  }

  try {
    const currentResult = await pool.query(
      `SELECT course_id, created_at FROM course_videos WHERE video_id = $1`,
      [video_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Current video not found'
      });
    }

    const { course_id, created_at } = currentResult.rows[0];

    const nextVideosResult = await pool.query(
      `SELECT 
          video_id,
          name AS title,
          description,
          video_url,
          thumbnail_url,
          user_id AS uploaded_by,
          created_at
       FROM course_videos
       WHERE course_id = $1
         AND video_id <> $2
       ORDER BY created_at ASC, video_id ASC
       LIMIT $3`,
      [course_id, video_id, limit]
    );

    res.status(200).json({
      success: true,
      current_video_id: parseInt(video_id),
      course_id: course_id,
      suggestions: nextVideosResult.rows,
      count: nextVideosResult.rows.length
    });
  } catch (err) {
    console.error('❌ Error fetching next course video suggestions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all videos (latest to old) - requires authentication
exports.getAllVideosLatest = async (req, res) => {
  // 1. requester_id: The person WATCHING the feed
  // 2. target_user_id: The creator whose videos we are looking at
  const requester_id = req.query.requester_id; // Pass this from Flutter
  const target_user_id = req.params.user_id; 

  if (!target_user_id || !requester_id) {
    return res.status(400).json({
      success: false,
      message: "Both target user_id and requester_id are required"
    });
  }

  try {
    const result = await pool.query(
      `SELECT 
         v.video_id,
         v.course_id,
         v.name,
         v.description,
         v.video_url,
         v.thumbnail_url,
         v.user_id,
         v.created_at,
         -- CHECK ENROLLMENT STATUS HERE
         CASE 
            WHEN e.user_id IS NOT NULL THEN true 
            ELSE false 
         END as is_enrolled
       FROM course_videos v
       LEFT JOIN enrollments e ON v.course_id = e.course_id AND e.user_id = $2
       WHERE v.user_id = $1
       ORDER BY v.created_at DESC`,
      [target_user_id, requester_id]
    );

    res.status(200).json({
      success: true,
      total_videos: result.rows.length,
      videos: result.rows
    });

  } catch (error) {
    console.error("❌ Error fetching latest videos:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserTotalViews = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ 
      success: false, 
      message: "User ID is required" 
    });
  }

  try {
    // 1. Get all videos uploaded by this user
    const videosResult = await pool.query(
      `SELECT video_id FROM course_videos WHERE user_id = $1`,
      [user_id]
    );

    const videoIds = videosResult.rows.map(v => v.video_id);

    if (videoIds.length === 0) {
      return res.status(200).json({
        success: true,
        user_id: user_id,
        total_views: 0
      });
    }

    // 2. Count total views for these videos
    const viewsResult = await pool.query(
      `SELECT SUM(watched_seconds) as total_watched_seconds,
              COUNT(*) as total_views
       FROM video_views
       WHERE video_id = ANY($1::int[])`,
      [videoIds]
    );

    res.status(200).json({
      success: true,
      user_id: user_id,
      total_views: parseInt(viewsResult.rows[0].total_views || 0),
      total_watched_seconds: parseInt(viewsResult.rows[0].total_watched_seconds || 0)
    });

  } catch (error) {
    console.error("❌ Error fetching total views:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get 6 random video suggestions from other creators
exports.getSuggestedVideos = async (req, res) => {
    // The current viewer's ID (to exclude their own videos and check enrollment)
    const { user_id } = req.params; 
    const limit = 6; 

    if (!user_id) {
        return res.status(400).json({ 
            success: false, 
            message: "User ID is required to filter suggestions" 
        });
    }

    try {
        const result = await pool.query(
            `SELECT 
                v.*,
                CASE 
                    WHEN e.user_id IS NOT NULL THEN true 
                    ELSE false 
                END as is_enrolled
             FROM course_videos v
             -- Join with enrollments to see if the requester has access to the course
             LEFT JOIN course_enrollments e ON v.course_id = e.course_id AND e.user_id = $1
             -- Exclude the requester's own videos
             WHERE v.user_id != $1
             -- Shuffle the results and limit to 6
             ORDER BY RANDOM()
             LIMIT $2`, 
            [user_id, limit]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            videos: result.rows
        });

    } catch (error) {
        console.error("❌ Error fetching suggested videos:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

exports.updateVideo = async (req, res) => {
    const { video_id } = req.params;
    const { name, description, course_id } = req.body;
    const user_id = req.user?.user_id || req.user?.id;

    if (!video_id) {
        return res.status(400).json({ success: false, message: "Video ID is required" });
    }
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const videoFile = req.files && req.files['video'] ? req.files['video'][0] : null;
    const thumbFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

    try {
        const existing = await pool.query(
            `SELECT video_url, thumbnail_url FROM course_videos WHERE video_id = $1 AND user_id = $2`,
            [video_id, user_id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Video not found or unauthorized" });
        }

        const currentVideo = existing.rows[0];
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(description);
        }
        if (course_id !== undefined) {
            updates.push(`course_id = $${paramIndex++}`);
            params.push(parseInt(course_id) > 0 ? parseInt(course_id) : null);
        }
        if (videoFile) {
            updates.push(`video_url = $${paramIndex++}`);
            params.push(getUploadUrl(videoFile));
        }
        if (thumbFile) {
            updates.push(`thumbnail_url = $${paramIndex++}`);
            params.push(getUploadUrl(thumbFile));
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: "No update data provided" });
        }

        params.push(video_id);
        params.push(user_id);

        const updateQuery = `UPDATE course_videos SET ${updates.join(', ')} WHERE video_id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`;
        const result = await pool.query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Video not found or unauthorized" });
        }

        if (videoFile && currentVideo.video_url && isLocalUrl(currentVideo.video_url)) {
            const absoluteVideoPath = path.join(__dirname, '../../', currentVideo.video_url);
            if (fs.existsSync(absoluteVideoPath)) fs.unlinkSync(absoluteVideoPath);
        }
        if (thumbFile && currentVideo.thumbnail_url && isLocalUrl(currentVideo.thumbnail_url)) {
            const absoluteThumbPath = path.join(__dirname, '../../', currentVideo.thumbnail_url);
            if (fs.existsSync(absoluteThumbPath)) fs.unlinkSync(absoluteThumbPath);
        }

        res.status(200).json({ success: true, video: result.rows[0] });
    } catch (error) {
        console.error("❌ Error updating video:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteVideo = async (req, res) => {
    const { video_id } = req.params;
    const { user_id } = req.body; // Security ke liye user_id check karna zaroori hai

    if (!video_id) {
        return res.status(400).json({ message: "Video ID is required" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Pehle check karein ki video exist karta hai aur usi user ka hai
        const videoCheck = await client.query(
            'SELECT video_url, thumbnail_url FROM course_videos WHERE video_id = $1 AND user_id = $2',
            [video_id, user_id]
        );

        if (videoCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Video not found or unauthorized" });
        }

        const videoPath = videoCheck.rows[0].video_url;
        const thumbPath = videoCheck.rows[0].thumbnail_url;

        // 2. Database se video delete karein (Foreign keys ki wajah se views aur lessons cascade ho sakte hain)
        await client.query('DELETE FROM course_videos WHERE video_id = $1', [video_id]);

        await client.query('COMMIT');

        // 3. Physical files ko server se delete karein
        const rootPath = path.join(__dirname, '../../'); // Project root tak ka path
        
        if (videoPath) {
            const absoluteVideoPath = path.join(rootPath, videoPath);
            if (fs.existsSync(absoluteVideoPath)) fs.unlinkSync(absoluteVideoPath);
        }

        if (thumbPath && !thumbPath.includes('default_placeholder')) {
            const absoluteThumbPath = path.join(rootPath, thumbPath);
            if (fs.existsSync(absoluteThumbPath)) fs.unlinkSync(absoluteThumbPath);
        }

        res.status(200).json({ success: true, message: "Video and files deleted successfully" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Delete Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};
