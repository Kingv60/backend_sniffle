const pool = require("../config/db");

// List all courses
exports.getCourses = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT course_id, title, description, level, language, created_at FROM courses ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single course with lessons
exports.getCourseById = async (req, res) => {
  const { id } = req.params;

  try {
    const courseResult = await pool.query(
      "SELECT course_id, title, description, level, language, created_at FROM courses WHERE course_id = $1",
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const lessonsResult = await pool.query(
      `
      SELECT lesson_id, title, video_url, order_index, created_at
      FROM course_lessons
      WHERE course_id = $1
      ORDER BY order_index ASC, created_at ASC
      `,
      [id]
    );

    res.json({
      ...courseResult.rows[0],
      lessons: lessonsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Enroll in a course
exports.enroll = async (req, res) => {
  const user_id = req.user.user_id;
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ error: "course_id is required" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO course_enrollments (course_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (course_id, user_id) DO NOTHING
      RETURNING *
      `,
      [course_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.json({ message: "Already enrolled" });
    }

    res.status(201).json({ message: "Enrolled successfully", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get my enrolled courses
exports.getMyCourses = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
      `
      SELECT c.course_id, c.title, c.description, c.level, c.language, ce.enrolled_at
      FROM course_enrollments ce
      JOIN courses c ON c.course_id = ce.course_id
      WHERE ce.user_id = $1
      ORDER BY ce.enrolled_at DESC
      `,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

