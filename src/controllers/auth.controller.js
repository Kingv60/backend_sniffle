const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


exports.checkUsername = async (req, res) => {
  try {
    const { name } = req.body; // 'name' is what comes from Flutter/Postman

    if (!name) {
      return res.status(400).json({ available: false, message: "Username is required" });
    }

    // 🔴 FIXED: Changed 'name' to 'username' to match your CREATE TABLE script
    const result = await pool.query(
      "SELECT username FROM user_profile WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [name]
    );


    if (result.rows.length > 0) {
      return res.status(200).json({ 
        available: false, 
        message: "Username is already taken" 
      });
    }

    return res.status(200).json({ 
      available: true, 
      message: "Username is available" 
    });

  } catch (error) {
  
    res.status(500).json({ 
      available: false, 
      message: "Server Error",
      debug: error.message 
    });
  }
};
// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email`,
      [name, email, hashedPassword, null]
    );

    const user = result.rows[0];

    // 🔐 Generate Token
    const token = jwt.sign(
      { user_id: user.user_id },
      "skillconnect_secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      token: token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Ensure the token belongs to the user being deleted
    const authUserId = req.user.user_id; // from authMiddleware
    if (parseInt(userId) !== authUserId) {
      return res.status(403).json({ message: "Forbidden: cannot delete another user" });
    }

    // Delete the user
    const result = await pool.query(
      "DELETE FROM users WHERE user_id = $1 RETURNING *",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });

  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};



// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { user_id: user.user_id },
      "skillconnect_secret",
      { expiresIn: "1d" }
    );

    res.json({
  message: "Login successful",
  user_id: user.user_id,
  token: token
});

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
