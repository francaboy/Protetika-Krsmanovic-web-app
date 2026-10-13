const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Utvrđuje ID kartona pacijenta iz req.params (boardId), req.body (board_id) ili req.query,
 * provjerava da li je trenutni korisnik vlasnik ili dodijeljeni član,
 * i postavlja req.board = { id, owner_id, role }.
 */
const requireBoardAccess = asyncHandler(async (req, _res, next) => {
  const boardId =
    req.params.boardId || req.params.id || req.body.board_id || req.query.board_id;

  if (!boardId) throw ApiError.badRequest("Identifikator pacijenta je obavezan");

  const { rows } = await query(
    `SELECT b.id, b.owner_id, m.role
       FROM boards b
       LEFT JOIN board_members m
         ON m.board_id = b.id AND m.user_id = $2
      WHERE b.id = $1`,
    [boardId, req.user.id]
  );

  const board = rows[0];
  if (!board) throw ApiError.notFound("Pacijent nije pronađen");

  const isOwner = board.owner_id === req.user.id;
  if (!isOwner && !board.role) {
    throw ApiError.forbidden("Nemate ovlašćenje za pristup ovom pacijentu");
  }

  req.board = {
    id: board.id,
    owner_id: board.owner_id,
    role: isOwner ? "owner" : board.role,
  };
  next();
});

module.exports = { requireBoardAccess };