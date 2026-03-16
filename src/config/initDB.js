const pool = require("./db");

const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("Initializing Database...");
    await client.query("BEGIN");

    // ================= USERS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
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

    // ================= MEDIA POSTS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS media_posts (
        post_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        caption TEXT,
        media_url TEXT NOT NULL,
        media_type VARCHAR(20) NOT NULL,
        created_by INT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_media_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // ================= VIDEO METADATA =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_metadata (
        metadata_id SERIAL PRIMARY KEY,
        post_id INT NOT NULL UNIQUE,
        duration_seconds INT,
        resolution VARCHAR(20),
        thumbnail_url TEXT,
        processing_status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_video_post FOREIGN KEY(post_id) REFERENCES media_posts(post_id) ON DELETE CASCADE
      );
    `);

    // ================= VIDEO STATS (views & watch time) =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_stats (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL UNIQUE,
        view_count BIGINT DEFAULT 0,
        total_watch_seconds BIGINT DEFAULT 0,
        CONSTRAINT fk_vs_post FOREIGN KEY(post_id) REFERENCES media_posts(post_id) ON DELETE CASCADE
      );
    `);

    // ================= LIVE STREAMS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_streams (
        stream_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255),
        stream_key VARCHAR(100) UNIQUE NOT NULL, 
        is_live BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_stream_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // ================= STREAM VIEWERS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS stream_viewers (
        viewer_id SERIAL PRIMARY KEY,
        stream_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_viewer_stream FOREIGN KEY(stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE,
        CONSTRAINT fk_viewer_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
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

    // ================= MESSAGES =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT,
        message_type VARCHAR(20) DEFAULT 'text',
        is_read BOOLEAN DEFAULT FALSE,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_msg_conv FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
        CONSTRAINT fk_msg_sender FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // ================= COURSES =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        course_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        level VARCHAR(50),
        language VARCHAR(50),
        created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
    // ================= PROJECTS =================
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        project_id SERIAL PRIMARY KEY,
        owner_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        tech_stack TEXT[], 
        members_count INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_project_owner FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
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
// This tracks Likes (Join Requests) and Passes (Swiped Left)
await client.query(`  
  CREATE TABLE IF NOT EXISTS project_interactions (
    interaction_id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    sender_id INT NOT NULL,
    type VARCHAR(20) CHECK (type IN ('like', 'pass')), 
    message TEXT,  
    status VARCHAR(20) DEFAULT 'pending', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_int_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    CONSTRAINT fk_int_sender FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(project_id, sender_id)
  );
`);

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
      console.log("Database Setup Finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initDB;