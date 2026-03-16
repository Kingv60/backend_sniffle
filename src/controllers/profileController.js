const pool = require("../config/db");

exports.createProfile = async (req, res) => {
  const user_id = req.user.user_id;
  const { username, skills, bio, role } = req.body;

  try {
    const existing = await pool.query(
      "SELECT * FROM user_profile WHERE user_id = $1",
      [user_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Profile already exists" });
    }

    let avatar_url = null;

    if (req.file) {
      avatar_url = `/uploads/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO user_profile
       (user_id, username, skills, bio, role, avatar_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [user_id, username, skills, bio, role, avatar_url, user_id]
    );

   const profileWithName = await pool.query(
  `SELECT p.*, u.name
   FROM user_profile p
   JOIN users u ON u.user_id = p.user_id
   WHERE p.user_id = $1`,
  [user_id]
);

res.status(201).json(profileWithName.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET OWN PROFILE
exports.getMyProfile = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
  `SELECT p.*, u.name
   FROM user_profile p
   JOIN users u ON u.user_id = p.user_id
   WHERE p.user_id = $1`,
  [user_id]
);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const user_id = req.user.user_id;
  const { username, skills, bio, role } = req.body;

  try {

    // get current profile
    const current = await pool.query(
      "SELECT avatar_url FROM user_profile WHERE user_id=$1",
      [user_id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // keep old avatar if new not uploaded
    const avatar_url = req.file
      ? `/uploads/${req.file.filename}`
      : current.rows[0].avatar_url;

    const result = await pool.query(
      `UPDATE user_profile 
       SET username=$1, skills=$2, bio=$3, role=$4, avatar_url=$5
       WHERE user_id=$6
       RETURNING *`,
      [username, skills, bio, role, avatar_url, user_id]
    );

   const profileWithName = await pool.query(
  `SELECT p.*, u.name
   FROM user_profile p
   JOIN users u ON u.user_id = p.user_id
   WHERE p.user_id = $1`,
  [user_id]
);

res.json(profileWithName.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};