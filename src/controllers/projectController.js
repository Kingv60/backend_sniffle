const pool = require("../config/db");

// 1. PROJECT CREATE
exports.createProject = async (req, res) => {
  const { title, description, tech_stack, members_count } = req.body;
  const owner_id = req.user.user_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectRes = await client.query(
      "INSERT INTO projects (owner_id, title, description, tech_stack, members_count, likes_count) VALUES ($1, $2, $3, $4, $5, 0) RETURNING *",
      [owner_id, title, description, tech_stack, members_count]
    );
    const project = projectRes.rows[0];

    const conversationRes = await client.query(
      "INSERT INTO conversations (created_by) VALUES ($1) RETURNING conversation_id",
      [owner_id]
    );
    const conversation_id = conversationRes.rows[0].conversation_id;

    await client.query(
      "INSERT INTO project_conversations (project_id, conversation_id) VALUES ($1, $2)",
      [project.project_id, conversation_id]
    );

    await client.query(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)",
      [conversation_id, owner_id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      project: { ...project, is_liked: false },
      project_chat: { conversation_id, project_id: project.project_id }
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// 2. SPECIFIC USER PROJECTS (Personal Feed)
exports.getMyProjects = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const result = await pool.query(
      `SELECT p.*, 
       EXISTS (SELECT 1 FROM project_interactions WHERE project_id = p.project_id AND sender_id = $1 AND type = 'like') as is_liked
       FROM projects p 
       WHERE owner_id = $1 
       ORDER BY created_at DESC`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. GLOBAL FEED (Discovery)
exports.getGlobalFeed = async (req, res) => {
  const user_id = req.user.user_id;
  const skillFilterEnabled = req.query.filter_by_skill === 'true' || req.query.skill_filter === 'true';

  try {
    const likeStatusQuery = `
      EXISTS (
        SELECT 1 FROM project_interactions 
        WHERE project_id = p.project_id 
        AND sender_id = $1 
        AND type = 'like'
      ) as is_liked
    `;

    let query;
    let params = [user_id];

    if (skillFilterEnabled) {
      const profileResult = await pool.query('SELECT skills FROM user_profile WHERE user_id = $1', [user_id]);
      const skillArray = (profileResult.rows[0]?.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      
      if (skillArray.length === 0) return res.json([]);
      params.push(skillArray);

      query = `
        SELECT p.*, up.username, up.avatar_url, ${likeStatusQuery}
        FROM projects p
        JOIN user_profile up ON p.owner_id = up.user_id
        WHERE p.owner_id != $1
          AND p.project_id NOT IN (SELECT project_id FROM project_interactions WHERE sender_id = $1 AND type = 'pass')
          AND EXISTS (SELECT 1 FROM unnest(p.tech_stack) AS tech WHERE lower(tech) = ANY($2))
        ORDER BY p.created_at DESC;
      `;
    } else {
      query = `
        SELECT p.*, up.username, up.avatar_url, ${likeStatusQuery}
        FROM projects p
        JOIN user_profile up ON p.owner_id = up.user_id
        WHERE p.owner_id != $1 
        AND p.project_id NOT IN (SELECT project_id FROM project_interactions WHERE sender_id = $1 AND type = 'pass')
        ORDER BY p.created_at DESC;
      `;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. TOGGLE LIKE (Like / Unlike)
exports.toggleLikeProject = async (req, res) => {
  const { project_id } = req.body;
  const user_id = req.user.user_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const check = await client.query("SELECT type FROM project_interactions WHERE project_id = $1 AND sender_id = $2", [project_id, user_id]);

    if (check.rows.length > 0 && check.rows[0].type === 'like') {
      await client.query("DELETE FROM project_interactions WHERE project_id = $1 AND sender_id = $2", [project_id, user_id]);
      await client.query("UPDATE projects SET likes_count = GREATEST(0, likes_count - 1) WHERE project_id = $1", [project_id]);
      await client.query("COMMIT");
      return res.json({ message: "Unliked", is_liked: false });
    } else {
      await client.query(`INSERT INTO project_interactions (project_id, sender_id, type, status) VALUES ($1, $2, 'like', 'done') 
                         ON CONFLICT (project_id, sender_id) DO UPDATE SET type = 'like'`, [project_id, user_id]);
      await client.query("UPDATE projects SET likes_count = likes_count + 1 WHERE project_id = $1", [project_id]);
      await client.query("COMMIT");
      return res.json({ message: "Liked", is_liked: true });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// 5. DISCARD PROJECT (Pass)
exports.discardProject = async (req, res) => {
  const { project_id } = req.body;
  const user_id = req.user.user_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const checkLike = await client.query("SELECT type FROM project_interactions WHERE project_id = $1 AND sender_id = $2", [project_id, user_id]);

    if (checkLike.rows.length > 0 && checkLike.rows[0].type === 'like') {
      await client.query("UPDATE projects SET likes_count = GREATEST(0, likes_count - 1) WHERE project_id = $1", [project_id]);
    }

    await client.query(`INSERT INTO project_interactions (project_id, sender_id, type, status) VALUES ($1, $2, 'pass', 'done')
                       ON CONFLICT (project_id, sender_id) DO UPDATE SET type = 'pass'`, [project_id, user_id]);

    await client.query("COMMIT");
    res.json({ message: "Project passed" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// 6. GET LIKED PROJECTS
exports.getLikedProjects = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, up.username, up.avatar_url, true as is_liked
       FROM projects p
       JOIN project_interactions pi ON p.project_id = pi.project_id
       JOIN user_profile up ON p.owner_id = up.user_id
       WHERE pi.sender_id = $1 AND pi.type = 'like'
       ORDER BY pi.created_at DESC`,
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 7. PROJECT BY ID
exports.getProjectById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, up.username, up.avatar_url,
       EXISTS (SELECT 1 FROM project_interactions WHERE project_id = p.project_id AND sender_id = $2 AND type = 'like') as is_liked
       FROM projects p JOIN user_profile up ON p.owner_id = up.user_id 
       WHERE p.project_id = $1`,
      [req.params.id, req.user.user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 8. PROJECT CHAT LOOKUP
exports.getProjectChat = async (req, res) => {
  try {
    const projectId = req.params.id;
    const user_id = req.user.user_id;

    const projectResult = await pool.query(
      `SELECT p.*, up.username, up.avatar_url,
       EXISTS (SELECT 1 FROM project_interactions WHERE project_id = p.project_id AND sender_id = $2 AND type = 'like') as is_liked
       FROM projects p JOIN user_profile up ON p.owner_id = up.user_id WHERE p.project_id = $1`,
      [projectId, user_id]
    );

    if (projectResult.rows.length === 0) return res.status(404).json({ error: "Project not found" });

    const convResult = await pool.query("SELECT conversation_id FROM project_conversations WHERE project_id = $1", [projectId]);
    const conversation_id = convResult.rows[0].conversation_id;

    const participantsResult = await pool.query(
      `SELECT u.user_id, up.username, up.avatar_url FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.user_id LEFT JOIN user_profile up ON u.user_id = up.user_id
       WHERE cp.conversation_id = $1`, [conversation_id]
    );

    if (!participantsResult.rows.some(p => p.user_id === user_id)) return res.status(403).json({ error: "Access denied" });

    res.json({ project: projectResult.rows[0], conversation_id, participants: participantsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add these to the end of projectController.js

// 9. UPDATE REQUEST STATUS: Owner accepts / rejects a join request
exports.updateRequestStatus = async (req, res) => {
  const owner_id = req.user.user_id;
  const { id } = req.params; // interaction_id
  const { status } = req.body; // 'accepted' or 'rejected'

  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await pool.query(
      `UPDATE project_interactions pi
       SET status = $1
       FROM projects p
       WHERE pi.interaction_id = $2 AND pi.project_id = p.project_id AND p.owner_id = $3
       RETURNING pi.*, p.title`,
      [status, id, owner_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Not authorized or not found" });

    // If accepted, add them to the chat automatically
    if (status === "accepted") {
      const interaction = result.rows[0];
      const conv = await pool.query("SELECT conversation_id FROM project_conversations WHERE project_id = $1", [interaction.project_id]);
      if (conv.rows.length > 0) {
        await pool.query(
          "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [conv.rows[0].conversation_id, interaction.sender_id]
        );
      }
    }

    res.json({ message: `Request ${status}`, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 10. OWNER REQUESTS: See who liked your projects to join
exports.getOwnerRequests = async (req, res) => {
  try {
    const query = `
      SELECT pi.*, p.title as project_title, up.username as applicant_name, up.avatar_url
      FROM project_interactions pi
      JOIN projects p ON pi.project_id = p.project_id
      JOIN user_profile up ON pi.sender_id = up.user_id
      WHERE p.owner_id = $1 AND pi.type = 'like' AND pi.status = 'done'
      ORDER BY pi.created_at DESC;
    `;
    const result = await pool.query(query, [req.user.user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. GET LIKED PROJECTS: Fetch all projects the user has swiped right on
exports.getLikedProjects = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT 
        p.*, 
        up.username, 
        up.avatar_url,
        true as is_liked -- Since these are from the liked list, is_liked is always true
       FROM projects p
       JOIN project_interactions pi ON p.project_id = pi.project_id
       JOIN user_profile up ON p.owner_id = up.user_id
       WHERE pi.sender_id = $1 
         AND pi.type = 'like'
       ORDER BY pi.created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching liked projects:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.sendRequest = async (req, res) => {
  const { project_id, message } = req.body;
  const sender_id = req.user.user_id;

  try {
    const result = await pool.query(
      `INSERT INTO project_interactions 
         (project_id, sender_id, type, message, status) 
       VALUES ($1, $2, 'like', $3, 'done') 
       RETURNING *`,
      [project_id, sender_id, message]
    );

    res.json({ message: "Request sent successfully", data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: "Request already sent or project unavailable" });
  }
};