const pool = require("../config/db");
const { messaging } = require("../config/firebase");
const { getUploadUrl } = require("../utils/uploadHelpers");


// ================= START CONVERSATION =================
exports.startConversation = async (req, res) => {
    
const sender_id = req.user && req.user.user_id;
  const { receiver_id, project_id } = req.body;


  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // For project conversations
    if (project_id) {
      // Check if project conversation already exists
      const existingProject = await client.query(
        `
        SELECT c.conversation_id
        FROM conversations c
        JOIN project_conversations pc
          ON pc.conversation_id = c.conversation_id
        WHERE pc.project_id = $1
        LIMIT 1
        `,
        [project_id]
      );

      if (existingProject.rows.length > 0) {
        await client.query("COMMIT");
        return res.json({
          conversation_id: existingProject.rows[0].conversation_id,
          message: "Project conversation already exists",
          is_project_chat: true
        });
      }

      // Create new project conversation
      const conv = await client.query(
        `INSERT INTO conversations DEFAULT VALUES RETURNING conversation_id`
      );

      const conversation_id = conv.rows[0].conversation_id;

      // Link to project
      await client.query(
        `INSERT INTO project_conversations (project_id, conversation_id)
         VALUES ($1, $2)`,
        [project_id, conversation_id]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        conversation_id,
        is_project_chat: true
      });

    } else {
      // Personal 1-1 conversation
      // check if personal conversation already exists
      const existing = await client.query(
        `
        SELECT c.conversation_id
        FROM conversations c
        JOIN conversation_participants p1
          ON p1.conversation_id = c.conversation_id
        JOIN conversation_participants p2
          ON p2.conversation_id = c.conversation_id
        LEFT JOIN project_conversations pc
          ON pc.conversation_id = c.conversation_id
        WHERE p1.user_id = $1
        AND p2.user_id = $2
        AND pc.conversation_id IS NULL
        LIMIT 1
        `,
        [sender_id, receiver_id]
      );

      if (existing.rows.length > 0) {
        await client.query("COMMIT");
        return res.json({
          conversation_id: existing.rows[0].conversation_id,
          message: "Conversation already exists",
          is_project_chat: false
        });
      }

      // create new personal conversation
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
        conversation_id,
        is_project_chat: false
      });
    }

  } catch (err) {

    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });

  } finally {
    client.release();
  }
};


// ================= GET USER CHAT LIST =================
exports.getUserChats = async (req, res) => {
  const user_id = req.user && req.user.user_id;

  try {
    const result = await pool.query(
      `
      SELECT
        c.conversation_id,
        c2.user_id AS other_user_id,
        CASE 
          WHEN p.project_id IS NOT NULL THEN p.title
          ELSE u.name
        END AS name,
        COALESCE(up.avatar_url, '/uploads/default-avatar.png') AS avatar,
        m.message AS last_message,
        m.created_date AS last_time,
        p.project_id,
        p.title AS project_title,
        CASE WHEN p.project_id IS NOT NULL THEN true ELSE false END AS is_project_chat
      FROM conversations c
      JOIN conversation_participants cp
        ON cp.conversation_id = c.conversation_id
        AND cp.user_id = $1
      LEFT JOIN project_conversations pc
        ON pc.conversation_id = c.conversation_id
      LEFT JOIN projects p
        ON p.project_id = pc.project_id
      LEFT JOIN LATERAL (
        SELECT user_id
        FROM conversation_participants
        WHERE conversation_id = c.conversation_id
          AND user_id != $1
        LIMIT 1
      ) c2 ON true
      LEFT JOIN users u
        ON u.user_id = c2.user_id
      LEFT JOIN user_profile up
        ON up.user_id = COALESCE(c2.user_id, p.owner_id)
      LEFT JOIN LATERAL (
        SELECT message, created_date
        FROM messages
        WHERE conversation_id = c.conversation_id
        ORDER BY created_date DESC
        LIMIT 1
      ) m ON true
      ORDER BY m.created_date DESC NULLS LAST;
      `,
      [user_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ================= TOGGLE MESSAGE REACTION =================
exports.toggleReaction = async (req, res) => {
  const user_id = req.user && req.user.user_id;
  const { message_id, emoji } = req.body;

  if (!message_id || !emoji) {
    return res.status(400).json({ error: "Message ID and emoji are required" });
  }

  try {
    // 1. Check if reaction already exists for this user on this message
    const existing = await pool.query(
      "SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2",
      [message_id, user_id]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].emoji === emoji) {
        // CASE: Same emoji clicked again -> Remove it (Toggle off)
        await pool.query(
          "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2",
          [message_id, user_id]
        );
        return res.json({ success: true, action: "removed" });
      } else {
        // CASE: Different emoji clicked -> Update it
        await pool.query(
          "UPDATE message_reactions SET emoji = $1 WHERE message_id = $2 AND user_id = $3",
          [emoji, message_id, user_id]
        );
        return res.json({ success: true, action: "updated", emoji });
      }
    }

    // 2. No existing reaction -> Insert new one
    await pool.query(
      "INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)",
      [message_id, user_id, emoji]
    );

    res.json({ success: true, action: "added", emoji });

  } catch (err) {
    console.error("Error toggling reaction:", err);
    res.status(500).json({ error: err.message });
  }
};


// ================= GET MESSAGES OF CHAT (Updated) =================
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        m.message_id,
        m.conversation_id, -- Added for model consistency
        m.message,
        m.sender_id,
        m.created_date,
        m.message_type,    -- NEW: Added this
        m.file_url,        -- NEW: Added this
        m.file_name,       -- NEW: Added this
        u.name,
        -- Subquery to fetch reactions as a JSON array
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'user_id', mr.user_id, 
              'emoji', mr.emoji,
              'username', ru.name
            )
          )
           FROM message_reactions mr
           JOIN users ru ON ru.user_id = mr.user_id
           WHERE mr.message_id = m.message_id
          ), 
          '[]'
        ) AS reactions
      FROM messages m
      JOIN users u ON u.user_id = m.sender_id
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



// ================= SEND MESSAGE (Updated for Files/Links) =================

// 1. Firebase messaging instance ko import karein


// ================= SEND MESSAGE (Updated with Firebase Push) =================
exports.sendMessage = async (req, res) => {
  const sender_id = req.user && req.user.user_id;
  const { conversation_id, message, message_type } = req.body;

  try {
    let file_url = null;
    let file_name = null;

    if (req.file) {
      file_url = getUploadUrl(req.file);
      file_name = req.file.originalname;
    }

    // 1. Message Insert karein AND user_profile se username fetch karein
    const result = await pool.query(
      `
      WITH inserted_msg AS (
        INSERT INTO messages
        (conversation_id, sender_id, message, file_url, file_name, message_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      )
      SELECT im.*, up.username as sender_username 
      FROM inserted_msg im
      LEFT JOIN user_profile up ON up.user_id = im.sender_id
      `,
      [conversation_id, sender_id, message || null, file_url, file_name, message_type || 'text']
    );

    const savedMessage = result.rows[0];
    // Agar profile nahi bani toh fallback "Someone" par rakha hai
    const finalSenderName = savedMessage.sender_username || "Someone";

    // 2. Recipient ka FCM token nikalen
    const recipientResult = await pool.query(
      `
      SELECT u.fcm_token 
      FROM conversation_participants cp
      JOIN users u ON u.user_id = cp.user_id
      WHERE cp.conversation_id = $1 AND cp.user_id != $2
      LIMIT 1
      `,
      [conversation_id, sender_id]
    );

    const fcmToken = recipientResult.rows[0]?.fcm_token;

    if (fcmToken) {
      // 3. Body formatting (text vs files)
      const displayContent = savedMessage.message_type === 'text' 
        ? savedMessage.message 
        : `Sent you a ${savedMessage.message_type}`;

      const payload = {
        token: fcmToken,
        notification: {
          title: finalSenderName, // Notification title mein @username dikhega
          body: `${finalSenderName}: ${displayContent}`, // Format -> username: Hello
        },
        data: {
          conversation_id: conversation_id.toString(),
          sender_id: sender_id.toString(),
          type: "CHAT_MESSAGE",
        },
        android: {
          priority: "high",
          notification: {
            channel_id: "messages",
            sound: "default",
          },
        },
      };

      messaging.send(payload)
        .then(response => console.log("Push sent successfully:", response))
        .catch(error => console.error("Push notification error:", error));
    }

    res.json(savedMessage);

  } catch (err) {
    console.error("Send Message Error:", err);
    res.status(500).json({ error: err.message });
  }
};

