const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireBoardAccess } = require("../middleware/boardAccess");
const board = require("../controllers/boardController");
const column = require("../controllers/columnController");
const task = require("../controllers/taskController");
const ai = require("../controllers/aiController");

const router = express.Router();

router.use(requireAuth);

// Globalna arhiva za sve pacijente
router.get("/archived-tasks/all", task.listAllArchived);

// Collection
router.get("/", board.listBoards);
router.post("/", board.createBoard);

// Single board (access-guarded)
router.get("/:boardId", requireBoardAccess, board.getBoard);
router.patch("/:boardId", requireBoardAccess, board.updateBoard);
router.delete("/:boardId", requireBoardAccess, board.deleteBoard);

// Activity feed (pregled i brisanje)
router.get("/:boardId/activity", requireBoardAccess, board.getActivity);
router.delete("/:boardId/activity", requireBoardAccess, board.clearActivity);

// Members
router.post("/:boardId/members", requireBoardAccess, board.addMember);
router.delete("/:boardId/members/:userId", requireBoardAccess, board.removeMember);

// Columns
router.post("/:boardId/columns", requireBoardAccess, column.createColumn);
router.patch("/:boardId/columns/:columnId", requireBoardAccess, column.updateColumn);
router.delete("/:boardId/columns/:columnId", requireBoardAccess, column.deleteColumn);

// Tasks
router.get("/:boardId/tasks", requireBoardAccess, task.listTasks);
router.post("/:boardId/tasks", requireBoardAccess, task.createTask);
router.patch("/:boardId/tasks/:taskId", requireBoardAccess, task.updateTask);
router.patch("/:boardId/tasks/:taskId/move", requireBoardAccess, task.moveTask);
router.patch("/:boardId/tasks/:taskId/archive", requireBoardAccess, task.archiveTask);
router.patch("/:boardId/tasks/:taskId/restore", requireBoardAccess, task.restoreTask);
router.delete("/:boardId/tasks/:taskId", requireBoardAccess, task.deleteTask);

// AI
router.post("/:boardId/ai/generate-tasks", requireBoardAccess, ai.generateTasks);
router.post("/:boardId/ai/breakdown", requireBoardAccess, ai.breakdownTask);
router.post("/:boardId/ai/summary", requireBoardAccess, ai.summarizeBoard);

module.exports = router;