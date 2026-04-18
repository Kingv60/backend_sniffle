// const pool = require("./db");
const pool = require("../config/db");

const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("Initializing Database...");
    await client.query("BEGIN");
    

    // ================= USERS =================// Important
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  fcm_token TEXT,  -- 🔥 ADD THIS
  created_by INT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    `);

    // ================= USER PROFILE =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        profile_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL,
        skills TEXT,
        bio TEXT,
        role VARCHAR(100),
        avatar_url VARCHAR(255),
        created_by INT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_profile FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

  
    // ================= CONVERSATIONS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_id SERIAL PRIMARY KEY,
        created_by INT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================= PROJECTS =================
    await client.query(`
  CREATE TABLE IF NOT EXISTS projects (
    project_id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    tech_stack TEXT[], 
    members_count INT DEFAULT 1,
    likes_count INT DEFAULT 0, -- <--- Added this line
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_owner FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE
  );
`);

    // ================= PROJECT CONVERSATIONS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_conversations (
        project_id INT UNIQUE NOT NULL,
        conversation_id INT UNIQUE NOT NULL,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pc_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        CONSTRAINT fk_pc_conversation FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
      );
    `);

    // ================= CONVERSATION PARTICIPANTS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cp_conv FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
        CONSTRAINT fk_cp_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT uq_conv_user UNIQUE(conversation_id, user_id)
      );
    `);

    // ================= MESSAGES (Updated Version) =================
await client.query(`
  CREATE TABLE IF NOT EXISTS messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT,                   
    file_url VARCHAR(500),        
    file_name VARCHAR(255),        
    message_type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_conv FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_sender FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE
  );
`);


    // ================= MESSAGE REACTIONS =================
await client.query(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    reaction_id SERIAL PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    emoji VARCHAR(20) NOT NULL, -- To store the emoji (e.g., '❤️', '🔥')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reaction_message FOREIGN KEY(message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
    CONSTRAINT fk_reaction_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT uq_message_user_reaction UNIQUE(message_id, user_id) -- One reaction per user per message
  );
`);

// Add index for faster lookup when loading chat
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);
`);

    // ================= COURSES =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        course_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        level VARCHAR(50),
        language VARCHAR(50),
        price DECIMAL(10,2) DEFAULT 0,
        thumbnail_url TEXT,
        created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================= COURSE PAYMENTS =================
await client.query(`
  CREATE TABLE IF NOT EXISTS course_payments (
    payment_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_course_payments_user 
  ON course_payments(user_id);

  CREATE INDEX IF NOT EXISTS idx_course_payments_course 
  ON course_payments(course_id);
`);

    // ================= COURSE LESSONS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS course_lessons (
        lesson_id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        video_url TEXT,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================= COURSE ENROLLMENTS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS course_enrollments (
        enrollment_id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_course_user UNIQUE(course_id, user_id)
      );
    `);

    // ================= COURSE VIDEOS ================= (Fixed column names)
   
      // course_videos table ke liye - SAFE VERSION
  await client.query(`
  CREATE TABLE IF NOT EXISTS course_videos (
    video_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(course_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL REFERENCES users(user_id)
  );
`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_course_videos_course_time ON course_videos(course_id, created_at DESC);
    `);

    // ================= PROJECT REQUESTS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_requests (
        request_id SERIAL PRIMARY KEY,
        project_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending', 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_req_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        CONSTRAINT fk_req_sender FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(project_id, sender_id)
      );
    `);

    // ================= PROJECT INTERACTIONS =================
   await client.query(`   
  CREATE TABLE IF NOT EXISTS project_interactions (
    interaction_id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    sender_id INT NOT NULL,
    type VARCHAR(20) CHECK (type IN ('like', 'pass')), 
    message TEXT,  
    status VARCHAR(20) DEFAULT 'done', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_int_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    CONSTRAINT fk_int_sender FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(project_id, sender_id) -- <--- Crucial: One interaction per user per project
  );
`);

    
    await client.query(`
      UPDATE user_profile 
      SET avatar_url = CASE 
        WHEN avatar_url IS NOT NULL AND avatar_url != '' 
             AND avatar_url NOT LIKE '/uploads/%' 
             AND avatar_url NOT LIKE 'http%' 
             AND avatar_url NOT LIKE 'https%' 
             AND (avatar_url LIKE '%.jpg' OR avatar_url LIKE '%.png' OR avatar_url LIKE '%.jpeg' OR avatar_url LIKE '%uploads/%')
        THEN CONCAT('/uploads/', avatar_url)
        ELSE avatar_url 
      END
      WHERE avatar_url IS NOT NULL AND avatar_url != '';
    `);

    

    await client.query(`
      UPDATE course_lessons 
      SET video_url = CASE 
        WHEN video_url IS NOT NULL AND video_url != '' AND video_url NOT LIKE '/uploads/%' AND video_url NOT LIKE 'http%' AND video_url NOT LIKE 'https%'
        THEN CONCAT('/uploads/', video_url)
        ELSE video_url 
      END
      WHERE video_url IS NOT NULL AND video_url != '';
    `);

    await client.query(`
      UPDATE course_videos 
      SET video_url = CASE 
        WHEN video_url IS NOT NULL AND video_url != '' AND video_url NOT LIKE '/uploads/%' AND video_url NOT LIKE 'http%' AND video_url NOT LIKE 'https%'
        THEN CONCAT('/uploads/', video_url)
        ELSE video_url 
      END,
      thumbnail_url = CASE 
        WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' AND thumbnail_url NOT LIKE '/uploads/%' AND thumbnail_url NOT LIKE 'http%' AND thumbnail_url NOT LIKE 'https%'
        THEN CONCAT('/uploads/', thumbnail_url)
        ELSE thumbnail_url 
      END
      WHERE (video_url IS NOT NULL AND video_url != '') OR (thumbnail_url IS NOT NULL AND thumbnail_url != '');
    `);

// ================= Post Section =================
// ================= POSTS (Feed Images/Videos) =================
await client.query(`
  CREATE TABLE IF NOT EXISTS posts (
    post_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    caption TEXT,
    location VARCHAR(255),
    media_url VARCHAR(500) NOT NULL,      -- This is the 'file' field
    media_type VARCHAR(20) NOT NULL,      -- 'image' or 'video'
    duration_seconds INT DEFAULT 0, 
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// ================= POST LIKES =================
await client.query(`
  CREATE TABLE IF NOT EXISTS post_likes (
    like_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id) -- Prevents double liking
  );
`);

// ================= POST COMMENTS =================
await client.query(`
  CREATE TABLE IF NOT EXISTS post_comments (
    comment_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// ================= INDEXES FOR SPEED =================
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
`);


    // ================= REELS =================

    await client.query(`
      CREATE TABLE IF NOT EXISTS reels (
        reelid SERIAL PRIMARY KEY,
        userid INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        caption TEXT,
        reelurl VARCHAR(500),
        thumbnailurl VARCHAR(500),
        duration INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reelviews (
        reelid INT NOT NULL REFERENCES reels(reelid) ON DELETE CASCADE,
        viewerid INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        watchedseconds INTEGER DEFAULT 0,
        PRIMARY KEY (reelid, viewerid)
      );
    `);

    // ================= VIDEO VIEWS (Tracking & Seconds) =================
// Is table mein 'watched_seconds' aur 'UNIQUE' constraint add kiya hai.
await client.query(`
  CREATE TABLE IF NOT EXISTS video_views (
    view_id SERIAL PRIMARY KEY,
    video_id INT REFERENCES course_videos(video_id) ON DELETE CASCADE,
    post_id INT REFERENCES posts(post_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    watched_seconds INT DEFAULT 0,  -- Kitne seconds video dekhi
    last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- UNIQUE Constraint: Taaki ek user ka ek video par ek hi record rahe
    CONSTRAINT unique_user_video_view UNIQUE (user_id, video_id),
    CONSTRAINT unique_user_post_view UNIQUE (user_id, post_id)
  );
`);

// reel like and comment
// ================= REEL LIKES =================
await client.query(`
  CREATE TABLE IF NOT EXISTS reel_likes (
    like_id SERIAL PRIMARY KEY,
    reelid INT NOT NULL REFERENCES reels(reelid) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reelid, user_id)
  );
`);

// ================= REEL COMMENTS =================
await client.query(`
  CREATE TABLE IF NOT EXISTS reel_comments (
    comment_id SERIAL PRIMARY KEY,
    reelid INT NOT NULL REFERENCES reels(reelid) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Index for performance
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_video_views_vid ON video_views(video_id);
  CREATE INDEX IF NOT EXISTS idx_video_views_post ON video_views(post_id);
`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reels_userid ON reels(userid);
      CREATE INDEX IF NOT EXISTS idx_reels_createdat ON reels(createdat DESC);
      CREATE INDEX IF NOT EXISTS idx_reelviews_reelid ON reelviews(reelid);
    `);

    console.log('✅ URL paths fixed successfully!');

    // ========== COMMIT ALL CHANGES ==========
    await client.query("COMMIT");
    console.log("✅ All tables created successfully!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error initializing DB:", err.message);
    throw err;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  initDB()
    .then(() => {
      console.log("🎉 Database Setup Finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initDB;
