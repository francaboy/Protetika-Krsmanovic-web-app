const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
} = require("../controllers/notificationController");

const router = express.Router();
router.use(requireAuth);

router.get("/", listNotifications);
router.patch("/read-all", markAllAsRead);
router.delete("/clear-all", clearAllNotifications);
router.patch("/:id/read", markAsRead);

module.exports = router;