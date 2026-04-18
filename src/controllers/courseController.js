const pool = require("../config/db");
const { getUploadUrl } = require("../utils/uploadHelpers");

// List all courses
exports.getCourses = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT course_id, title, description, level, language, price, thumbnail_url, created_at
       FROM courses
       ORDER BY created_at DESC`
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
  `SELECT course_id, title, description, level, language, price, thumbnail_url, created_at
   FROM courses
   WHERE course_id = $1`,
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
  SELECT c.course_id,
         c.title,
         c.description,
         c.level,
         c.language,
         c.price,
         c.thumbnail_url,
         ce.enrolled_at
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

// Get courses created by the authenticated user
exports.getMyCreatedCourses = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await pool.query(
  `
  SELECT course_id,
         title,
         description,
         level,
         language,
         price,
         thumbnail_url,
         created_at
  FROM courses
  WHERE created_by = $1
  ORDER BY created_at DESC
  `,
  [user_id]
);

    // Ensure we return all courses (no limit)
    res.json({
      success: true,
      count: result.rows.length,
      courses: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//get courses by user_id
// Get courses created by a specific user (public)
exports.getCoursesByUserId = async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
  `
  SELECT course_id,
         title,
         description,
         level,
         language,
         price,
         thumbnail_url,
         created_at
  FROM courses
  WHERE created_by = $1
  ORDER BY created_at DESC
  `,
  [user_id]
);

    res.json({
      success: true,
      user_id: user_id,
      count: result.rows.length,
      courses: result.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create course
exports.createCourse = async (req, res) => {
  const { title, description, level, language, price } = req.body;
  const user_id = req.user.user_id;

  // Handle thumbnail upload
  let thumbnail_url = null;
  if (req.file) {
    thumbnail_url = getUploadUrl(req.file);
  }

  try {
    const result = await pool.query(
      `INSERT INTO courses 
      (title, description, level, language, price, thumbnail_url, created_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        title,
        description,
        level,
        language,
        price || 0, // if user doesn't set price → default 0 (free course)
        thumbnail_url,
        user_id
      ]
    );

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check if user already enrolled in course
exports.checkEnrollment = async (req, res) => {
  const user_id = req.user.user_id;
  const { course_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 1
      FROM course_enrollments
      WHERE course_id = $1 AND user_id = $2
      `,
      [course_id, user_id]
    );

    res.json({
      enrolled: result.rows.length > 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
