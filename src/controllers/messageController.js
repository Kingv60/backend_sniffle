const pool = require("../config/db");


// ================= START CONVERSATION =================
exports.startConversation = async (req, res) => {
    
const sender_id = req.user && req.user.user_id;
  const { receiver_id } = req.body;


  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // check if conversation already exists
    const existing = await client.query(
      `
      SELECT c.conversation_id
      FROM conversations c
      JOIN conversation_participants p1
        ON p1.conversation_id = c.conversation_id
      JOIN conversation_participants p2
        ON p2.conversation_id = c.conversation_id
      WHERE p1.user_id = $1
      AND p2.user_id = $2
      LIMIT 1
      `,
      [sender_id, receiver_id]
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return res.json({
        conversation_id: existing.rows[0].conversation_id,
        message: "Conversation already exists"
      });
    }

    // create new conversation
    const conv = await client.query(
      `INSERT INTO conversations DEFAULT VALUES RETURNING conversation_id`
    );

    const conversation_id = conv.rows[0].conversation_id;

    // add participants
    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1,$2),($1,$3)`,
      [conversation_id, sender_id, receiver_id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      conversation_id
    });

  } catch (err) {

    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });

  } finally {
    client.release();
  }
};



// ================= GET USER CHAT LIST =================
// ================= GET USER CHAT LIST =================
// ================= GET USER CHAT LIST =================
exports.getUserChats = async (req, res) => {
  const user_id = req.user && req.user.user_id;

  try {
    const result = await pool.query(
      `
      SELECT 
        c.conversation_id,
        cp2.user_id,
        u.name,

        COALESCE(up.avatar_url, '/uploads/default-avatar.png') AS avatar,

        m.message AS last_message,
        m.created_date AS last_time

      FROM conversations c

      -- logged user
      JOIN conversation_participants cp
        ON cp.conversation_id = c.conversation_id
        AND cp.user_id = $1

      -- other user
      JOIN conversation_participants cp2
        ON cp2.conversation_id = c.conversation_id
        AND cp2.user_id != $1

      JOIN users u
        ON u.user_id = cp2.user_id

      -- avatar
      LEFT JOIN user_profile up
        ON up.user_id = cp2.user_id

      -- last message
      LEFT JOIN LATERAL (
        SELECT message, created_date
        FROM messages
        WHERE conversation_id = c.conversation_id
        ORDER BY created_date DESC
        LIMIT 1
      ) m ON true

      ORDER BY m.created_date DESC NULLS LAST
      `,
      [user_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};



// ================= GET MESSAGES OF CHAT =================
exports.getMessages = async (req, res) => {

  const { conversationId } = req.params;

  try {

    const result = await pool.query(
      `
      SELECT 
        m.message_id,
        m.message,
        m.sender_id,
        m.created_date,
        u.name

      FROM messages m

      JOIN users u
        ON u.user_id = m.sender_id

      WHERE m.conversation_id = $1
      ORDER BY m.created_date ASC
      `,
      [conversationId]
    );

    res.json(result.rows);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }
};



// ================= SEND MESSAGE =================
exports.sendMessage = async (req, res) => {

 const sender_id =req.user && req.user.user_id;
  const { conversation_id, message } = req.body;
    
  try {

    const result = await pool.query(
      `
      INSERT INTO messages
      (conversation_id, sender_id, message)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [conversation_id, sender_id, message]
    );

    res.json(result.rows[0]);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }
};

