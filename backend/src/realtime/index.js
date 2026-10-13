const { query } = require("../config/db");

let io = null;

const setIo = (instance) => {
  io = instance;
};

const boardRoom = (boardId) => `board:${boardId}`;
const userRoom = (userId) => `user:${userId}`;

/** Emitovanje događaja - emituje globalno tako da i sidebar i karton pacijenta ažuriraju podatke */
const emitToBoard = (boardId, event, payload) => {
  if (io) io.emit(event, payload);
};

/** Direktno emitovanje događaja određenom korisniku (npr. lična obavještenja) */
const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};
/** Globalno emitovanje svim povezanim klijentima */
const emitGlobal = (event, payload) => {
  if (io) io.emit(event, payload);
};

/**
 * Upisuje aktivnost u bazu podataka i emituje je u sobu kartona pacijenta.
 * Vraća kreirani red aktivnosti.
 */
const logActivity = async ({ boardId, userId, action, message, metadata }) => {
  const { rows } = await query(
    `INSERT INTO activities (board_id, user_id, action, message, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, board_id, user_id, action, message, metadata, created_at`,
    [boardId, userId || null, action, message, metadata ? JSON.stringify(metadata) : null]
  );
  const activity = rows[0];
  emitToBoard(boardId, "activity:new", activity);
  return activity;
};

module.exports = {
  setIo,
  emitToBoard,
  emitToUser,
  emitGlobal,
  logActivity,
  boardRoom,
  userRoom,
};