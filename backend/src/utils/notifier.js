const { query } = require("../config/db");
const { emitToUser } = require("../realtime");

/**
 * Šalje obavještenje listi korisnika (upisuje u DB i šalje socket)
 */
const notifyUsers = async ({ userIds, actorId, boardId, taskId, title, message, type = "info" }) => {
  if (!userIds || !userIds.length) return;

  // Filtriramo da korisnik koji je napravio akciju ne dobije sam sebi notifikaciju
  const targets = [...new Set(userIds.filter((id) => id && String(id) !== String(actorId)))];
  if (!targets.length) return;

  for (const uid of targets) {
    try {
      const { rows } = await query(
        `INSERT INTO notifications (user_id, actor_id, board_id, task_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          String(uid),
          actorId ? String(actorId) : null,
          boardId ? String(boardId) : null,
          taskId ? String(taskId) : null,
          title,
          message,
          type,
        ]
      );

      const notification = rows[0];

      // Šaljemo u realnom vremenu tom korisniku
      emitToUser(String(uid), "notification:new", notification);
    } catch (err) {
      console.error("Greška pri slanju notifikacije:", err);
    }
  }
};

/**
 * Vraća sve ID-jeve članova kartona pacijenta (sigurno poređenje UUID i TEXT)
 */
const getBoardMemberIds = async (boardId) => {
  try {
    const { rows } = await query(
      `SELECT user_id::text AS user_id FROM board_members WHERE board_id::text = $1::text
       UNION
       SELECT owner_id::text AS user_id FROM boards WHERE id::text = $1::text`,
      [String(boardId)]
    );
    return rows.map((r) => r.user_id);
  } catch (err) {
    console.error("Greška pri dohvatanju članova pacijenta:", err);
    return [];
  }
};

module.exports = { notifyUsers, getBoardMemberIds };