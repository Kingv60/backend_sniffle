const pool = require('../config/db');

exports.searchUsers = async (req, res) => {
  // Ensure query is a string, even if empty
  const query = req.query.query ? req.query.query.toString().trim() : '';
  const currentUserId = req.user.user_id;

  try {
    let sql;
    let params;

    if (query === '') {
      // CASE 1: EMPTY SEARCH (Blue Button Tapped)
      // Show 10 other users, excluding the logged-in user
      sql = `
        SELECT 
          u.user_id,
          u.name,
          COALESCE(up.avatar_url, '/uploads/default-avatar.png') AS avatar
        FROM users u
        LEFT JOIN user_profile up ON up.user_id = u.user_id
        WHERE u.user_id != $1 
        ORDER BY u.user_id DESC
        LIMIT 10
      `;
      params = [currentUserId];
    } else {
      // CASE 2: ACTIVE SEARCH (User typing)
      // Filter by name AND exclude the logged-in user
      sql = `
        SELECT 
          u.user_id,
          u.name,
          COALESCE(up.avatar_url, '/uploads/default-avatar.png') AS avatar
        FROM users u
        LEFT JOIN user_profile up ON up.user_id = u.user_id
        WHERE u.name ILIKE $1 
          AND u.user_id != $2
        ORDER BY u.name
        LIMIT 20
      `;
      params = [`%${query}%`, currentUserId];
    }

    const result = await pool.query(sql, params);
    res.json(result.rows);

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ error: "Database error occurred" });
  }
};