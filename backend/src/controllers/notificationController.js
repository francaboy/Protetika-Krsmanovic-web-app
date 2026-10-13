const { query } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/notifications
const listNotifications = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT n.*, 
            a.name AS actor_name, a.avatar_url AS actor_avatar,
            b.title AS board_title
       FROM notifications n
       LEFT JOIN users a ON a.id::text = n.actor_id::text
       LEFT JOIN boards b ON b.id::text = n.board_id::text
      WHERE n.user_id::text = $1::text
      ORDER BY n.created_at DESC
      LIMIT 40`,
    [req.user.id]
  );

  const unreadCountRes = await query(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id::text = $1::text AND is_read = FALSE`,
    [req.user.id]
  );

  res.json({
    notifications: rows,
    unreadCount: parseInt(unreadCountRes.rows[0].count, 10) || 0,
  });
});

// PATCH /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id::text = $2::text`,
    [req.params.id, req.user.id]
  );
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id::text = $1::text`,
    [req.user.id]
  );
  res.json({ success: true });
});

// DELETE /api/notifications/clear-all
const clearAllNotifications = asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM notifications WHERE user_id::text = $1::text`,
    [req.user.id]
  );
  res.json({ success: true });
});

module.exports = { listNotifications, markAsRead, markAllAsRead, clearAllNotifications };