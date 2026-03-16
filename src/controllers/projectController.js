const pool = require("../config/db");

// 1. PROJECT CREATE: Create a new project listing
exports.createProject = async (req, res) => {
  const { title, description, tech_stack, members_count } = req.body;
  const owner_id = req.user.user_id; 
  try {
    const result = await pool.query(
      "INSERT INTO projects (owner_id, title, description, tech_stack, members_count) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [owner_id, title, description, tech_stack, members_count]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. SPECIFIC USER PROJECTS: Get projects created by the logged-in user
exports.getMyProjects = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC",
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. GLOBAL FEED: Show projects to others (Swappable Logic)
exports.getGlobalFeed = async (req, res) => {
  const user_id = req.user.user_id;
  try {
    const query = `
      SELECT p.*, up.username, up.avatar_url 
      FROM projects p
      JOIN user_profile up ON p.owner_id = up.user_id
      WHERE p.owner_id != $1 
      AND p.project_id NOT IN (
        SELECT project_id FROM project_interactions WHERE sender_id = $1
      )
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(query, [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. PROJECT REQUEST SEND: Express interest (Swipe Right)
exports.sendRequest = async (req, res) => {
  const { project_id, message } = req.body;
  const sender_id = req.user.user_id;
  try {
    const result = await pool.query(
      "INSERT INTO project_interactions (project_id, sender_id, type, message) VALUES ($1, $2, 'like', $3) RETURNING *",
      [project_id, sender_id, message]
    );
    res.json({ message: "Request sent successfully", data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: "Request already sent or project unavailable" });
  }
};

// 4b. PROJECT REQUEST UPDATE: Owner accepts / rejects a request
exports.updateRequestStatus = async (req, res) => {
  const owner_id = req.user.user_id;
  const { id } = req.params; // interaction_id
  const { status } = req.body; // 'accepted' or 'rejected'

  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    // ensure this interaction belongs to a project owned by current user
    const result = await pool.query(
      `
      UPDATE project_interactions pi
      SET status = $1
      FROM projects p
      WHERE pi.interaction_id = $2
        AND pi.project_id = p.project_id
        AND p.owner_id = $3
      RETURNING pi.*, p.project_id, p.members_count
      `,
      [status, id, owner_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found or not authorized" });
    }

    const interaction = result.rows[0];

    // optional: bump members_count when accepted
    if (status === "accepted") {
      await pool.query(
        "UPDATE projects SET members_count = members_count + 1 WHERE project_id = $1",
        [interaction.project_id]
      );
    }

    res.json({ message: "Request updated", data: interaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. OWNER REQUESTS: See who wants to join your projects
exports.getOwnerRequests = async (req, res) => {
  try {
    const query = `
      SELECT pi.*, p.title as project_title, up.username as applicant_name, up.avatar_url
      FROM project_interactions pi
      JOIN projects p ON pi.project_id = p.project_id
      JOIN user_profile up ON pi.sender_id = up.user_id
      WHERE p.owner_id = $1 AND pi.type = 'like'
      ORDER BY pi.created_at DESC;
    `;
    const result = await pool.query(query, [req.user.user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5b. PROJECT PASS: mark project as "not interested" for feed
exports.passProject = async (req, res) => {
  const user_id = req.user.user_id;
  const { project_id } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: "project_id is required" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO project_interactions (project_id, sender_id, type, status)
      VALUES ($1, $2, 'pass', 'done')
      ON CONFLICT (project_id, sender_id) DO UPDATE
        SET type = EXCLUDED.type, status = EXCLUDED.status
      RETURNING *
      `,
      [project_id, user_id]
    );

    res.json({ message: "Project passed", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. SPECIFIC PROJECT DATA: Get details for one specific project
exports.getProjectById = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT p.*, up.username, up.avatar_url FROM projects p JOIN user_profile up ON p.owner_id = up.user_id WHERE p.project_id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};